import unittest
from fastapi.testclient import TestClient
from app.main import app, requests_tracker

class TestAegisXAPI(unittest.TestCase):
    def setUp(self):
        requests_tracker.clear()
        self.client = TestClient(app)
        # Login to obtain JWT token
        response = self.client.post("/api/login", json={
            "email": "priya@aegisx.io",
            "password": "analyst_priya"
        })
        self.assertEqual(response.status_code, 200)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_read_root(self):
        # Public route
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ONLINE")

    def test_unauthorized_access(self):
        # Attempt to access protected route without token
        response = self.client.get("/api/alerts")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication token missing or invalid")

    def test_invalid_token(self):
        # Attempt to access with invalid token
        response = self.client.get("/api/alerts", headers={"Authorization": "Bearer INVALID-TOKEN"})
        self.assertEqual(response.status_code, 401)

    def test_get_alerts(self):
        response = self.client.get("/api/alerts", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)

    def test_get_alert_detail(self):
        response = self.client.get("/api/alerts/ALT-MULE-001", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        detail = response.json()
        self.assertIn("alert", detail)
        self.assertEqual(detail["alert"]["id"], "ALT-MULE-001")

    def test_investigate_alert(self):
        response = self.client.post("/api/alerts/ALT-MULE-001/investigate", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertIn("case_report", result)
        self.assertIn("debate_transcript", result)

    def test_export_pdf(self):
        response = self.client.get("/api/alerts/ALT-MULE-001/export?format=pdf", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_export_docx(self):
        response = self.client.get("/api/alerts/ALT-MULE-001/export?format=docx", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"PK\x03\x04"))

    def test_export_pptx(self):
        response = self.client.get("/api/alerts/ALT-MULE-001/export?format=pptx", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"PK\x03\x04"))

    def test_malicious_input_sanitization(self):
        # Test XSS script tag payload gets blocked (400 Bad Request)
        response = self.client.post("/api/alerts/ALT-MULE-001/action", headers=self.headers, json={
            "action": "FREEZE",
            "notes": "<script>alert('XSS')</script>"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("Malicious script or query input detected", response.json()["detail"])

        # Test SQL Injection payload gets blocked (400 Bad Request)
        response = self.client.post("/api/alerts/ALT-MULE-001/action", headers=self.headers, json={
            "action": "FREEZE",
            "notes": "FREEZE; DROP TABLE accounts; --"
        })
        self.assertEqual(response.status_code, 400)

    def test_rate_limiting(self):
        # Send 100 requests rapidly to trigger rate limiting (429 Too Many Requests)
        for i in range(100):
            res = self.client.get("/api/alerts", headers=self.headers)
            if res.status_code == 429:
                break
        
        # The next request should definitely fail with 429
        response = self.client.get("/api/alerts", headers=self.headers)
        self.assertEqual(response.status_code, 429)
        self.assertIn("Request rate limit exceeded", response.json()["detail"])

    def test_red_team_scan(self):
        response = self.client.get("/api/red-team/run", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reports", data)
        self.assertIn("status", data)
        self.assertTrue(len(data["reports"]) > 0)
        first_scan = data["reports"][0]
        self.assertIn("name", first_scan)
        self.assertIn("cvss", first_scan)
        self.assertIn("mitigation_status", first_scan)
        self.assertIn("remediation_patch", first_scan)

    def test_get_case_evidence_proof(self):
        response = self.client.get("/api/alerts/ALT-MULE-001/evidence-proof", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("alert_id", data)
        self.assertIn("root_hash", data)
        self.assertIn("leaves_count", data)
        self.assertIn("evidence_vault", data)
        self.assertTrue(len(data["evidence_vault"]) > 0)
        first_item = data["evidence_vault"][0]
        self.assertIn("hash", first_item)
        self.assertIn("proof", first_item)

    def test_verify_case_evidence_integrity(self):
        # Fetch valid proof
        res_proof = self.client.get("/api/alerts/ALT-MULE-001/evidence-proof", headers=self.headers)
        self.assertEqual(res_proof.status_code, 200)
        proof_data = res_proof.json()
        
        first_item = proof_data["evidence_vault"][0]
        
        # Verify valid proof
        payload = {
            "target_hash": first_item["hash"],
            "proof": first_item["proof"]
        }
        res_verify = self.client.post("/api/alerts/ALT-MULE-001/verify-integrity", headers=self.headers, json=payload)
        self.assertEqual(res_verify.status_code, 200)
        verify_data = res_verify.json()
        self.assertEqual(verify_data["status"], "VERIFIED")
        self.assertTrue(verify_data["verified"])

        # Verify tampered proof fails
        payload_bad = {
            "target_hash": "a" * 64,
            "proof": first_item["proof"]
        }
        res_verify_bad = self.client.post("/api/alerts/ALT-MULE-001/verify-integrity", headers=self.headers, json=payload_bad)
        self.assertEqual(res_verify_bad.status_code, 200)
        verify_bad_data = res_verify_bad.json()
        self.assertEqual(verify_bad_data["status"], "FAILED")
        self.assertFalse(verify_bad_data["verified"])

    def test_get_sentinel_twins(self):
        response = self.client.get("/api/sentinel/twins", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("priya", data)
        self.assertIn("rahul", data)
        self.assertIn("dev", data)
        self.assertIn("meera", data)
        self.assertEqual(data["priya"]["role"], "Senior Fraud Analyst")
        self.assertIn("bias_vectors", data["priya"])

    def test_update_sentinel_telemetry(self):
        response = self.client.get("/api/sentinel/twins", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        initial_fatigue = response.json()["priya"]["fatigue_index"]

        payload = {"cpm": 450, "jitter": 48.2}
        response = self.client.post("/api/sentinel/update-telemetry", headers=self.headers, json=payload)
        self.assertEqual(response.status_code, 200)
        updated_data = response.json()
        updated_fatigue = updated_data["priya"]["fatigue_index"]
        
        self.assertTrue(updated_fatigue > initial_fatigue)
        self.assertTrue(updated_data["priya"]["bias_vectors"]["automation"] > 0.68)

    def test_run_sentinel_debate(self):
        response = self.client.post("/api/sentinel/run-debate/ALT-MULE-001", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["alert_id"], "ALT-MULE-001")
        self.assertIn("status", data)
        self.assertIn("votes", data)
        self.assertIn("dominant_vote", data)
        self.assertIn("consensus_confidence", data)
        self.assertIn("disagreement_entropy", data)
        self.assertIn("minority_report", data)
        self.assertIn("debate_transcript", data)
        self.assertTrue(len(data["debate_transcript"]) > 0)

    def test_chronos_log_event(self):
        payload = {
            "case_id": "ALT-MULE-001",
            "event_type": "TIMELINE_EXPANDED",
            "actor": "ANALYST_PRIYA",
            "payload": {"section": "TEST_LOG", "user_cadence_cpm": 220},
            "branch": "main"
        }
        response = self.client.post("/api/chronos/log-event", headers=self.headers, json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["case_id"], "ALT-MULE-001")
        self.assertEqual(data["event_type"], "TIMELINE_EXPANDED")
        self.assertIn("hash", data)

    def test_chronos_get_history(self):
        response = self.client.get("/api/chronos/case/ALT-MULE-001/history?branch=main", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["case_id"], "ALT-MULE-001")
        self.assertIn("history", data)
        self.assertIn("branches", data)
        self.assertTrue(len(data["history"]) > 0)
        self.assertEqual(data["history"][0]["event_type"], "CASE_CREATED")

    def test_chronos_reconstruct_state(self):
        response = self.client.get("/api/chronos/case/ALT-MULE-001/reconstruct?branch=main", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("state", data)
        self.assertIn("commits_replayed", data)
        self.assertEqual(data["state"]["alert_id"], "ALT-MULE-001")
        self.assertTrue(data["commits_replayed"] > 0)

    def test_chronos_fork_and_diff(self):
        history_res = self.client.get("/api/chronos/case/ALT-MULE-001/history?branch=main", headers=self.headers)
        self.assertEqual(history_res.status_code, 200)
        history_data = history_res.json()
        first_commit = history_data["history"][0]["hash"]

        fork_payload = {
            "parent_branch": "main",
            "new_branch_name": "hypothesis-testing-branch"
        }
        fork_res = self.client.post("/api/chronos/case/ALT-MULE-001/fork", headers=self.headers, json=fork_payload)
        self.assertEqual(fork_res.status_code, 200)
        fork_data = fork_res.json()
        self.assertEqual(fork_data["status"], "SUCCESS")
        self.assertEqual(fork_data["new_branch"], "hypothesis-testing-branch")

        log_payload = {
            "case_id": "ALT-MULE-001",
            "event_type": "ANALYST_OVERRIDE",
            "actor": "ANALYST_PRIYA",
            "payload": {"action": "FREEZE", "notes": "Hypothetical override freeze"},
            "branch": "hypothesis-testing-branch"
        }
        log_res = self.client.post("/api/chronos/log-event", headers=self.headers, json=log_payload)
        self.assertEqual(log_res.status_code, 200)
        fork_head = log_res.json()["hash"]

        diff_res = self.client.get(
            f"/api/chronos/case/ALT-MULE-001/diff?branch_a=main&commit_a={first_commit}&branch_b=hypothesis-testing-branch&commit_b={fork_head}",
            headers=self.headers
        )
        self.assertEqual(diff_res.status_code, 200)
        diff_data = diff_res.json()
        self.assertTrue(diff_data["has_changes"])
        self.assertIn("risk_score", diff_data["deltas"])

if __name__ == "__main__":
    unittest.main()
