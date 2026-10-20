import hashlib
import time
import uuid
from typing import Dict, List, Any, Optional
from .data import db

class ChronosEngine:
    """
    AEGIS-X CHRONOS Submodule.
    The Git-like investigation replay time machine and event sourcing engine.
    Computes cryptographic SHA256 hashes for historical case mutations,
    supports hypothesis branching/forking, state reconstruction, and decision diffing.
    """
    def __init__(self):
        pass

    def log_event(self, case_id: str, event_type: str, actor: str, payload: Dict[str, Any], branch: str = "main") -> Dict[str, Any]:
        """
        Appends an event to the immutable hash chain for the specified branch.
        """
        if case_id not in db.chronos_branch_pointers:
            db.chronos_branch_pointers[case_id] = {}
            
        parent_hash = db.chronos_branch_pointers[case_id].get(branch, "GENESIS_ROOT")
        timestamp = time.time()
        event_id = f"EVT-{uuid.uuid4().hex[:6].upper()}"

        # Cryptographic link
        hash_input = f"{parent_hash}|{timestamp}|{event_type}|{actor}|{str(payload)}"
        event_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

        commit = {
            "event_id": event_id,
            "case_id": case_id,
            "timestamp": timestamp,
            "event_type": event_type,
            "actor": actor,
            "branch": branch,
            "payload": payload,
            "parent_hash": parent_hash,
            "hash": event_hash
        }

        db.chronos_event_store.append(commit)
        db.chronos_branch_pointers[case_id][branch] = event_hash

        # Log audit trail
        db.add_audit_log(
            actor,
            "CHRONOS_EVENT_LOGGED",
            case_id,
            f"Commit created: {event_type} on branch [{branch}]. Hash: {event_hash[:8]}."
        )

        return commit

    def get_history(self, case_id: str, branch: str = "main") -> List[Dict[str, Any]]:
        """
        Traverses back from the head pointer to construct the verified linear commit history.
        """
        if case_id not in db.chronos_branch_pointers or branch not in db.chronos_branch_pointers[case_id]:
            return []

        head_hash = db.chronos_branch_pointers[case_id][branch]
        
        # Build map of hash -> commit for easy lookup
        commit_map = {c["hash"]: c for c in db.chronos_event_store if c["case_id"] == case_id and c["branch"] == branch}
        
        history = []
        current_hash = head_hash
        
        while current_hash != "GENESIS_ROOT":
            commit = commit_map.get(current_hash)
            if not commit:
                # Fallback: search globally in case-specific events if branch scope differs
                commit = next((c for c in db.chronos_event_store if c["hash"] == current_hash), None)
                
            if not commit:
                break
                
            history.append(commit)
            current_hash = commit["parent_hash"]

        # Reverse to show chronological order (oldest first)
        history.reverse()
        return history

    def get_branches(self, case_id: str) -> List[str]:
        """
        Returns all registered branches for the case.
        """
        if case_id not in db.chronos_branch_pointers:
            return ["main"]
        return list(db.chronos_branch_pointers[case_id].keys())

    def create_fork(self, case_id: str, parent_branch: str, new_branch_name: str) -> Dict[str, Any]:
        """
        Forks investigation by copying the latest head pointer of parent_branch to new_branch_name.
        """
        if case_id not in db.chronos_branch_pointers:
            db.chronos_branch_pointers[case_id] = {"main": "GENESIS_ROOT"}
            
        if parent_branch not in db.chronos_branch_pointers[case_id]:
            parent_branch = "main"

        head_pointer = db.chronos_branch_pointers[case_id][parent_branch]
        
        # Normalize branch name
        new_branch_name = new_branch_name.strip().lower().replace(" ", "-")
        db.chronos_branch_pointers[case_id][new_branch_name] = head_pointer

        # Log fork event
        self.log_event(
            case_id,
            "BRANCH_FORKED",
            "SYSTEM",
            {"parent_branch": parent_branch, "new_branch": new_branch_name},
            branch=new_branch_name
        )

        return {
            "status": "SUCCESS",
            "case_id": case_id,
            "parent_branch": parent_branch,
            "new_branch": new_branch_name,
            "head_commit": head_pointer
        }

    def reconstruct_state(self, case_id: str, branch: str = "main", target_timestamp: Optional[float] = None, target_commit: Optional[str] = None) -> Dict[str, Any]:
        """
        Replays the event log sequentially from genesis to reconstruct the case state.
        """
        history = self.get_history(case_id, branch)
        
        # Filter by timestamp or commit hash limit
        filtered_commits = []
        for c in history:
            if target_timestamp and c["timestamp"] > target_timestamp:
                break
            filtered_commits.append(c)
            if target_commit and c["hash"] == target_commit:
                break

        # Genesis base state
        state = {
            "alert_id": case_id,
            "status": "OPEN",
            "severity": "MEDIUM",
            "triggered_by": "UNKNOWN",
            "risk_score": 0.45,
            "evidence_count": 0,
            "evidence_files": [],
            "swarms_run": 0,
            "swarm_debate": [],
            "twin_debates_run": 0,
            "twin_debate": None,
            "mouse_tracks": [],
            "timeline_expansions": [],
            "overrides": []
        }

        # Apply state mutations sequentially
        for c in filtered_commits:
            etype = c["event_type"]
            payload = c["payload"]
            
            if etype == "CASE_CREATED":
                state["status"] = payload.get("status", "OPEN")
                state["severity"] = payload.get("severity", "MEDIUM")
                state["triggered_by"] = payload.get("triggered_by", "UNKNOWN")
                state["risk_score"] = payload.get("initial_risk_score", 0.45)
                
            elif etype == "TIMELINE_EXPANDED":
                state["timeline_expansions"].append({
                    "timestamp": c["timestamp"],
                    "section": payload.get("section"),
                    "cpm": payload.get("user_cadence_cpm")
                })
                
            elif etype == "MOUSE_TRACK":
                state["mouse_tracks"].append({
                    "timestamp": c["timestamp"],
                    "target": payload.get("target_node"),
                    "coordinates": payload.get("path_coordinates", [])
                })
                
            elif etype == "SWARM_DEBATE":
                state["swarms_run"] += 1
                state["swarm_debate"].append({
                    "timestamp": c["timestamp"],
                    "risk_breakdown": payload.get("risk_breakdown", {})
                })
                # Risk score updates dynamically based on swarm
                breakdown = payload.get("risk_breakdown", {})
                if breakdown:
                    avg_score = sum(breakdown.values()) / len(breakdown)
                    state["risk_score"] = round(avg_score, 3)
                    
            elif etype == "SENTINEL_TWIN_DEBATE":
                state["twin_debates_run"] += 1
                state["twin_debate"] = {
                    "timestamp": c["timestamp"],
                    "dominant_vote": payload.get("dominant_vote"),
                    "confidence": payload.get("consensus_confidence"),
                    "entropy": payload.get("disagreement_entropy"),
                    "votes": payload.get("votes", {})
                }
                
            elif etype == "EVIDENCE_ADDED":
                state["evidence_files"].append({
                    "timestamp": c["timestamp"],
                    "type": payload.get("evidence_type"),
                    "doc_id": payload.get("document_id"),
                    "hash": payload.get("hash")
                })
                state["evidence_count"] = len(state["evidence_files"])
                
            elif etype == "ANALYST_OVERRIDE":
                state["overrides"].append({
                    "timestamp": c["timestamp"],
                    "actor": c["actor"],
                    "notes": payload.get("notes"),
                    "action": payload.get("action")
                })
                state["status"] = payload.get("action", state["status"])
                if payload.get("action") == "FREEZE":
                    state["risk_score"] = 0.98
                elif payload.get("action") == "DISMISS":
                    state["risk_score"] = 0.05

        # Return reconstructed state metadata
        return {
            "reconstructed_at_commit": filtered_commits[-1]["hash"] if filtered_commits else "GENESIS_ROOT",
            "commits_replayed": len(filtered_commits),
            "state": state
        }

    def compute_diff(self, case_id: str, branch_a: str, commit_a: str, branch_b: str, commit_b: str) -> Dict[str, Any]:
        """
        Computes differences in the reconstructed states between Commit A and Commit B.
        """
        state_a = self.reconstruct_state(case_id, branch=branch_a, target_commit=commit_a)["state"]
        state_b = self.reconstruct_state(case_id, branch=branch_b, target_commit=commit_b)["state"]

        diffs = {}

        # Risk score diff
        if state_a["risk_score"] != state_b["risk_score"]:
            diffs["risk_score"] = {"before": state_a["risk_score"], "after": state_b["risk_score"]}
            
        # Status diff
        if state_a["status"] != state_b["status"]:
            diffs["status"] = {"before": state_a["status"], "after": state_b["status"]}
            
        # Evidence count diff
        if state_a["evidence_count"] != state_b["evidence_count"]:
            diffs["evidence_count"] = {"before": state_a["evidence_count"], "after": state_b["evidence_count"]}

        # Twin votes diff
        vote_a = state_a["twin_debate"].get("dominant_vote") if state_a["twin_debate"] else "NONE"
        vote_b = state_b["twin_debate"].get("dominant_vote") if state_b["twin_debate"] else "NONE"
        if vote_a != vote_b:
            diffs["twin_consensus_vote"] = {"before": vote_a, "after": vote_b}

        # List added evidence files
        files_a = {f["doc_id"]: f for f in state_a["evidence_files"]}
        files_b = {f["doc_id"]: f for f in state_b["evidence_files"]}
        
        added_files = [f for doc_id, f in files_b.items() if doc_id not in files_a]
        deleted_files = [f for doc_id, f in files_a.items() if doc_id not in files_b]

        if added_files:
            diffs["added_evidence"] = added_files
        if deleted_files:
            diffs["removed_evidence"] = deleted_files

        return {
            "case_id": case_id,
            "compare_commit_a": commit_a,
            "compare_commit_b": commit_b,
            "has_changes": len(diffs) > 0,
            "deltas": diffs
        }

# Singleton instance
chronos_engine = ChronosEngine()
