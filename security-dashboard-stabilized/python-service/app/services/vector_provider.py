import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import chromadb

class VectorStoreProvider(ABC):
    @abstractmethod
    def index_document_chunks(
        self, 
        organization_id: str, 
        document_id: str, 
        document_name: str, 
        chunk_ids: List[str], 
        texts: List[str], 
        metadatas: List[Dict[str, Any]], 
        embeddings: List[List[float]]
    ) -> None:
        """
        Indices chunk embeddings for a specific tenant document.
        """
        pass

    @abstractmethod
    def query_similar_chunks(
        self, 
        organization_id: str, 
        query_embedding: List[float], 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Queries top K similar chunks for a tenant organization.
        """
        pass

    @abstractmethod
    def delete_document_chunks(
        self, 
        organization_id: str, 
        document_id: str
    ) -> None:
        """
        Removes all vector embeddings matching a specific document id for a tenant.
        """
        pass


class ChromaDBProvider(VectorStoreProvider):
    def __init__(self, persist_dir: str = None):
        chroma_host = os.getenv("CHROMA_HOST", "")
        chroma_port = os.getenv("CHROMA_PORT", "8000")
        if chroma_host:
            self.client = chromadb.HttpClient(host=chroma_host, port=int(chroma_port))
        else:
            if not persist_dir:
                # Persistent directory in workspace python-service/chroma_db
                persist_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                    "chroma_db"
                )
            self.client = chromadb.PersistentClient(path=persist_dir)

    def _get_collection_name(self, organization_id: str) -> str:
        # Chroma collection names start with letter/digit, 3-63 chars, alphanumeric, underscore or hyphen
        safe_id = organization_id.replace("-", "_").lower()
        return f"org_{safe_id}"

    def index_document_chunks(
        self, 
        organization_id: str, 
        document_id: str, 
        document_name: str, 
        chunk_ids: List[str], 
        texts: List[str], 
        metadatas: List[Dict[str, Any]], 
        embeddings: List[List[float]]
    ) -> None:
        collection_name = self._get_collection_name(organization_id)
        collection = self.client.get_or_create_collection(name=collection_name)
        
        # Add document metadata to all chunks
        enhanced_metadatas = []
        for meta in metadatas:
            meta_copy = meta.copy()
            meta_copy["document_id"] = document_id
            meta_copy["document_name"] = document_name
            enhanced_metadatas.append(meta_copy)

        collection.add(
            ids=chunk_ids,
            documents=texts,
            metadatas=enhanced_metadatas,
            embeddings=embeddings
        )

    def query_similar_chunks(
        self, 
        organization_id: str, 
        query_embedding: List[float], 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        collection_name = self._get_collection_name(organization_id)
        # Check if collection exists; if not, return empty list
        try:
            collection = self.client.get_collection(name=collection_name)
        except Exception:
            return []

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )

        chunks = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{} for _ in docs]
            ids = results["ids"][0] if "ids" in results else ["" for _ in docs]
            
            for i in range(len(docs)):
                chunks.append({
                    "id": ids[i],
                    "text": docs[i],
                    "metadata": metas[i]
                })
        return chunks

    def delete_document_chunks(
        self, 
        organization_id: str, 
        document_id: str
    ) -> None:
        collection_name = self._get_collection_name(organization_id)
        try:
            collection = self.client.get_collection(name=collection_name)
            collection.delete(where={"document_id": document_id})
        except Exception:
            pass
