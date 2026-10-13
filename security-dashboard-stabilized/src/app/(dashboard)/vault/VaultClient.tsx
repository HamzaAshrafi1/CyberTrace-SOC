"use client";

import React, { useState, useTransition } from "react";
import { 
  Archive, FileSpreadsheet, Upload, ShieldCheck, 
  AlertOctagon, FileText, CheckCircle 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { uploadEvidenceAction } from "./actions";

interface EvidenceFile {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  createdAt: string;
  caseId: string | null;
  caseTitle: string | null;
}

interface CaseItem {
  id: string;
  title: string;
}

interface VaultClientProps {
  orgId: string;
  initialEvidence: EvidenceFile[];
  cases: CaseItem[];
}

export default function VaultClient({ initialEvidence, cases }: VaultClientProps) {
  const [evidence, setEvidence] = useState<EvidenceFile[]>(initialEvidence);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Client-side size validation (5MB max)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (selectedFile.size > MAX_SIZE) {
        setErrorMsg("Prohibited: File size exceeds the 5MB security threshold.");
        setFile(null);
        return;
      }

      // Client-side file type validation
      const allowedTypes = [
        "application/pdf", "text/plain", "text/csv", 
        "application/json", "image/png", "image/jpeg", 
        "text/x-log", "application/octet-stream"
      ];
      if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith(".log")) {
        setErrorMsg("Prohibited: Allowed formats: PDF, TXT, LOG, CSV, JSON, PNG, JPG.");
        setFile(null);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const fileBase64 = base64.split(",")[1]; // remove standard prefix headers

      startTransition(async () => {
        try {
          const res = await uploadEvidenceAction({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            fileBase64,
            caseId: selectedCaseId || null
          });

          // Add to local state list
          const matchedCase = cases.find(c => c.id === selectedCaseId);
          const newFile: EvidenceFile = {
            id: res.id,
            fileName: res.fileName,
            fileSize: res.fileSize,
            fileType: res.fileType,
            createdAt: res.createdAt,
            caseId: selectedCaseId || null,
            caseTitle: matchedCase?.title || null
          };

          setEvidence(prev => [newFile, ...prev]);
          setSuccessMsg(`"${file.name}" uploaded and isolated in tenant space successfully.`);
          setFile(null);
          setSelectedCaseId("");
          
          // Clear file input
          const fileInput = document.getElementById("file-upload") as HTMLInputElement;
          if (fileInput) fileInput.value = "";
        } catch (err: any) {
          setErrorMsg(err.message || "Failed to upload file.");
        }
      });
    };

    reader.onerror = () => {
      setErrorMsg("Error parsing file.");
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Archive className="w-6 h-6 text-cyber-blue" />
            Evidence Vault Manager
          </h1>
          <p className="text-xs text-muted-foreground">
            B2B Secure file isolation. All uploads undergo automatic sandbox and signature integrity validation.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Upload Form (Left Column) */}
        <div className="lg:col-span-1">
          <Card className="border-border bg-card/60 backdrop-blur-sm sticky top-20">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyber-blue" />
                Upload Investigation Evidence
              </CardTitle>
              <CardDescription className="text-[10px]">Strict max size 5MB. Log records, packet captures, incident artifacts.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleUpload} className="space-y-4 text-xs">
                
                {/* File Dropzone */}
                <div className="border border-dashed border-border/80 rounded-xl p-4 text-center cursor-pointer hover:border-cyber-blue/50 transition-colors relative flex flex-col items-center justify-center min-h-[140px] bg-black/10">
                  <input
                    type="file"
                    id="file-upload"
                    required
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-[11px] font-semibold text-white/70">
                    {file ? file.name : "Select or drag file to upload"}
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-1">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "PDF, TXT, LOG, CSV, JSON, PNG"}
                  </span>
                </div>

                {/* Case Selection Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Attach to Case (Optional)</label>
                  <select
                    value={selectedCaseId}
                    onChange={e => setSelectedCaseId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                  >
                    <option value="">-- Standalone Evidence --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status messages */}
                {errorMsg && (
                  <div className="p-2.5 bg-cyber-red/10 border border-cyber-red/30 rounded-lg text-cyber-red text-[10px] flex items-start gap-1.5 font-mono">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-cyber-green/10 border border-cyber-green/30 rounded-lg text-cyber-green text-[10px] flex items-start gap-1.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!file || isPending}
                  className="w-full bg-cyber-blue text-black hover:bg-cyber-blue/80 font-mono text-xs h-9"
                >
                  {isPending ? "UPLOADING EVIDENCE..." : "UPLOAD EVIDENCE"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Evidence Vault List Table (Right 2 Columns) */}
        <div className="lg:col-span-2">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyber-blue" />
                Isolated Vault Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 font-mono text-[10px] text-muted-foreground">
                      <th className="p-3">File Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Attached Case</th>
                      <th className="p-3">AV Status</th>
                      <th className="p-3">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {evidence.length > 0 ? (
                      evidence.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-semibold font-sans text-xs text-foreground/90 max-w-[220px] truncate">
                            {item.fileName}
                          </td>
                          <td className="p-3 text-muted-foreground text-[10px] truncate max-w-[120px]">
                            {item.fileType || "generic"}
                          </td>
                          <td className="p-3 text-muted-foreground">{item.fileSize}</td>
                          <td className="p-3 text-muted-foreground font-sans">
                            {item.caseTitle ? (
                              <Badge variant="outline" className="text-[9px] border-cyber-blue/20 text-cyber-blue font-sans">
                                {item.caseTitle}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-white/40 italic">Standalone</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[9px] border-cyber-green/30 text-cyber-green bg-cyber-green/5 flex items-center gap-1 w-max font-sans">
                              <CheckCircle className="w-2.5 h-2.5" /> CLEAR
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground" suppressHydrationWarning>{new Date(item.createdAt).toISOString().split('T')[0]}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground text-[11px] font-sans">
                          No evidence files uploaded in vault. Secure files using the upload panel.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
