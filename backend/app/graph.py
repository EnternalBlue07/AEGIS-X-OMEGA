import networkx as nx
from typing import Dict, List, Any
from .data import db

class Layer3NetworkScorer:
    """
    Layer 3 Network Intelligence.
    Uses NetworkX to build entity-relation graphs, compute PageRank,
    detect fraud ring communities using the Louvain algorithm, and
    propagate risk scores.
    """
    def __init__(self):
        self.model_version = "networkx_graph_l3_v2.0.4"

    def build_network_graph(self) -> nx.Graph:
        """
        Builds a NetworkX undirected graph representing users, accounts, devices, and IPs.
        """
        G = nx.Graph()
        
        # Add Accounts
        for acc_id, acc in db.accounts.items():
            user_name = db.users[acc.user_id].name if acc.user_id in db.users else "Unknown"
            G.add_node(
                acc_id, 
                type="ACCOUNT", 
                label=f"{user_name} ({acc.rail_type})", 
                rail=acc.rail_type,
                status=acc.status
            )
            
        # Add Transactions as edges between Accounts
        for txn in db.transactions.values():
            if txn.account_id in db.accounts and txn.counterparty_account_id in db.accounts:
                # Add edge or update weight/amount
                if G.has_edge(txn.account_id, txn.counterparty_account_id):
                    G[txn.account_id][txn.counterparty_account_id]['weight'] += 1
                    G[txn.account_id][txn.counterparty_account_id]['amount'] += txn.amount
                else:
                    G.add_edge(
                        txn.account_id, 
                        txn.counterparty_account_id, 
                        type="TRANSACTION", 
                        weight=1, 
                        amount=txn.amount
                    )
                    
            # Add Device linkage
            if txn.device_id:
                G.add_node(txn.device_id, type="DEVICE", label=txn.device_id)
                G.add_edge(txn.account_id, txn.device_id, type="SHARED_DEVICE")
                
            # Add IP linkage
            if txn.ip_address:
                G.add_node(txn.ip_address, type="IP", label=txn.ip_address)
                G.add_edge(txn.account_id, txn.ip_address, type="SHARED_IP")
                
        return G

    def compute_network_metrics(self) -> Dict[str, Any]:
        """
        Runs PageRank, Louvain Community Detection, and risk propagation.
        Returns metrics per account.
        """
        G = self.build_network_graph()
        if len(G) == 0:
            return {}

        # 1. PageRank Centrality (identifies hubs)
        pageranks = nx.pagerank(G, weight='weight')
        
        # 2. Louvain Community Detection
        # Louvain communities returns sets of nodes representing clusters
        try:
            from networkx.algorithms.community import louvain_communities
            communities_list = louvain_communities(G)
        except Exception:
            # Fallback for older networkx versions
            from networkx.algorithms.community import greedy_modularity_communities
            communities_list = greedy_modularity_communities(G)
            
        communities = {}
        for cluster_id, nodes in enumerate(communities_list):
            for node in nodes:
                communities[node] = cluster_id

        # 3. Risk Propagation: Start with seed fraud alerts
        # Confirmed risk is 1.0 for accounts directly linked to high-severity alerts.
        # Propagated risk is computed by looking at neighbor risks.
        node_risk = {}
        # Seed risk
        for alt in db.alerts.values():
            if alt.severity == "HIGH" and alt.status != "DISMISSED":
                if alt.entity_type == "ACCOUNT":
                    node_risk[alt.entity_id] = 1.0
                elif alt.entity_type == "TRANSACTION":
                    # Find transaction account
                    if alt.entity_id in db.transactions:
                        txn = db.transactions[alt.entity_id]
                        node_risk[txn.account_id] = 1.0

        # Perform 2-step propagation
        for _ in range(2):
            new_risk = node_risk.copy()
            for node in G.nodes():
                if G.nodes[node].get("type") == "ACCOUNT":
                    # Risk of neighbors
                    neighbors = list(G.neighbors(node))
                    if neighbors:
                        avg_neighbor_risk = sum(node_risk.get(nb, 0.0) for nb in neighbors) / len(neighbors)
                        # Blend current node risk with propagated neighbor risk
                        current_r = node_risk.get(node, 0.0)
                        new_risk[node] = max(current_r, avg_neighbor_risk * 0.7)
            node_risk = new_risk

        return {
            "pageranks": pageranks,
            "communities": communities,
            "risks": node_risk
        }

    def get_network_risk_score(self, account_id: str) -> Dict[str, Any]:
        """
        Returns the network risk metrics specifically for one account.
        """
        metrics = self.compute_network_metrics()
        
        pagerank = metrics.get("pageranks", {}).get(account_id, 0.0)
        community_id = metrics.get("communities", {}).get(account_id, 0)
        risk = metrics.get("risks", {}).get(account_id, 0.0)
        
        # Calculate cluster size
        cluster_nodes = [node for node, cid in metrics.get("communities", {}).items() if cid == community_id]
        mule_likelihood = 0.0
        
        # Heuristics for mule accounts:
        # High pagerank (receives many connections) but low age or flagged community membership
        G = self.build_network_graph()
        if account_id in G:
            degree = G.degree(account_id)
            if degree > 3 and risk > 0.5:
                mule_likelihood = 0.8
            elif degree > 2:
                mule_likelihood = 0.4
                
        return {
            "network_risk_score": round(risk, 3),
            "pagerank_centrality": round(pagerank * 100, 3), # Scale for display
            "community_id": community_id,
            "cluster_size": len(cluster_nodes),
            "mule_account_likelihood": round(mule_likelihood, 3),
            "model_version": self.model_version
        }

    def get_d3_graph(self) -> Dict[str, Any]:
        """
        Formats G into a JSON payload compatible with D3 force-directed visualizer.
        """
        G = self.build_network_graph()
        metrics = self.compute_network_metrics()
        
        nodes = []
        for n, data in G.nodes(data=True):
            ntype = data.get("type", "UNKNOWN")
            label = data.get("label", n)
            
            # Map type to color category
            # Group mappings: 1=ACCOUNT, 2=DEVICE, 3=IP, 4=OTHER
            group = 1
            if ntype == "DEVICE":
                group = 2
            elif ntype == "IP":
                group = 3
                
            # Get risk
            risk = metrics.get("risks", {}).get(n, 0.0)
            
            # Scale value (node size)
            val = 8
            if ntype == "ACCOUNT":
                val = 15 + int(metrics.get("pageranks", {}).get(n, 0.0) * 300)
            elif ntype == "DEVICE" or ntype == "IP":
                val = 10
                
            nodes.append({
                "id": n,
                "label": label,
                "type": ntype,
                "group": group,
                "risk": round(risk, 2),
                "val": val,
                "community": metrics.get("communities", {}).get(n, 0)
            })
            
        links = []
        for u, v, data in G.edges(data=True):
            links.append({
                "source": u,
                "target": v,
                "type": data.get("type", "LINK"),
                "amount": round(data.get("amount", 0.0), 2) if "amount" in data else 0
            })
            
        return {"nodes": nodes, "links": links}

l3_scorer = Layer3NetworkScorer()
