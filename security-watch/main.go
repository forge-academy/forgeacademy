// security-watch is a standalone, dependency-free watchdog for the
// ForgeAcademy backend. It is NOT part of the app and is never deployed
// alongside it — it lives only in CI (see .github/workflows/security-watch.yml),
// runs on a schedule, and probes the already-deployed backend from the
// outside, the same way an attacker or a pen-test would. It never writes
// real data: every check either hits a read-only endpoint or deliberately
// uses a wrong admin key / malformed body, so a bug here can't touch
// production data.
//
// It exits non-zero if any check fails, which fails the GitHub Actions run
// (visible as a red X, and GitHub emails on scheduled-workflow failure by
// default) — a standing alarm for security regressions, not a gate in the
// deploy path.
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const wrongAdminKey = "definitely-not-the-real-admin-key-security-watch-probe"

type check struct {
	name string
	run  func(client *http.Client, baseURL string) error
}

func main() {
	baseURL := os.Getenv("TARGET_URL")
	if baseURL == "" {
		baseURL = "https://forgeacademy.onrender.com"
	}

	client := &http.Client{Timeout: 15 * time.Second}

	checks := []check{
		{"backend is reachable", checkReachable},
		{"security headers are present", checkSecurityHeaders},
		{"admin read endpoint rejects a wrong key (fails closed)", checkAdminReadFailsClosed},
		{"full-wipe endpoint rejects a wrong key (fails closed)", checkWipeFailsClosed},
		{"CORS does not reflect an unknown origin", checkCORSDoesNotReflectUnknownOrigin},
		{"malformed registration body is rejected, not crashed", checkMalformedInputRejected},
		{"admin endpoint rate-limits repeated requests", checkRateLimitEngages},
	}

	fmt.Printf("security-watch: probing %s\n\n", baseURL)

	failed := 0
	for _, c := range checks {
		err := c.run(client, baseURL)
		if err != nil {
			failed++
			fmt.Printf("FAIL  %-60s %v\n", c.name, err)
		} else {
			fmt.Printf("OK    %s\n", c.name)
		}
	}

	fmt.Println()
	if failed > 0 {
		fmt.Printf("%d/%d checks failed\n", failed, len(checks))
		os.Exit(1)
	}
	fmt.Printf("all %d checks passed\n", len(checks))
}

func checkReachable(client *http.Client, baseURL string) error {
	resp, err := client.Get(baseURL + "/health")
	if err != nil {
		return fmt.Errorf("could not reach /health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected 200 from /health, got %d", resp.StatusCode)
	}
	return nil
}

func checkSecurityHeaders(client *http.Client, baseURL string) error {
	resp, err := client.Get(baseURL + "/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	want := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}
	for header, expected := range want {
		got := resp.Header.Get(header)
		if got != expected {
			return fmt.Errorf("%s: expected %q, got %q", header, expected, got)
		}
	}
	return nil
}

func checkAdminReadFailsClosed(client *http.Client, baseURL string) error {
	req, err := http.NewRequest(http.MethodGet, baseURL+"/api/enrollments", nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Admin-Key", wrongAdminKey)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		return fmt.Errorf("expected 403 for a wrong admin key, got %d — admin data may be exposed", resp.StatusCode)
	}
	return nil
}

func checkWipeFailsClosed(client *http.Client, baseURL string) error {
	req, err := http.NewRequest(http.MethodDelete, baseURL+"/api/enrollments", nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Admin-Key", wrongAdminKey)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		return fmt.Errorf("expected 403 for a wrong admin key, got %d — the full-wipe endpoint may be unguarded", resp.StatusCode)
	}
	return nil
}

func checkCORSDoesNotReflectUnknownOrigin(client *http.Client, baseURL string) error {
	req, err := http.NewRequest(http.MethodGet, baseURL+"/health", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Origin", "https://attacker.example")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	allowOrigin := resp.Header.Get("Access-Control-Allow-Origin")
	if allowOrigin == "https://attacker.example" {
		return fmt.Errorf("CORS reflected an unrecognized origin — allowlist may have been loosened")
	}
	return nil
}

func checkMalformedInputRejected(client *http.Client, baseURL string) error {
	body := bytes.NewBufferString(`{"name": "", "email": "not-an-email"}`)
	resp, err := client.Post(baseURL+"/api/register", "application/json", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		return fmt.Errorf("expected 422 for an invalid registration body, got %d", resp.StatusCode)
	}
	return nil
}

// checkRateLimitEngages fires a burst of requests, all rejected on the admin
// key before touching the database, and expects the rate limiter to start
// returning 429 partway through. Uses the admin-read endpoint (30/minute)
// rather than the wipe endpoint (3/minute) so a routine run doesn't eat into
// the wipe endpoint's already-tight budget.
func checkRateLimitEngages(client *http.Client, baseURL string) error {
	const burst = 35
	saw429 := false

	for i := 0; i < burst; i++ {
		req, err := http.NewRequest(http.MethodGet, baseURL+"/api/enrollments", nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-Admin-Key", wrongAdminKey)

		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusTooManyRequests {
			saw429 = true
			break
		}
	}

	if !saw429 {
		return fmt.Errorf("sent %d rapid requests and never got a 429 — rate limiting may be disabled in production", burst)
	}
	return nil
}
