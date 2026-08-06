import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

export default function SignaturePage() {
  const sigCanvas = useRef(null);
  const [signature, setSignature] = useState("");

  const clearSignature = () => {
    sigCanvas.current.clear();
    setSignature("");
  };

  const saveSignature = () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please draw your signature first.");
      return;
    }

    const image = sigCanvas.current
      .getTrimmedCanvas()
      .toDataURL("image/png");

    setSignature(image);

    console.log("Base64 Signature:", image);

    // Send this to backend
    // axios.post("/api/signature", { signature: image });
  };

  const downloadSignature = () => {
    if (!signature) return;

    const link = document.createElement("a");
    link.href = signature;
    link.download = "signature.png";
    link.click();
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1>Service Agreement</h1>

        <p style={styles.text}>
          Please read the agreement carefully before signing.
        </p>

        <div style={styles.agreement}>
          <p>
            This is a sample agreement page.
          </p>

          <p>
            By signing below, you confirm that you have read the agreement
            and accept all the terms and conditions.
          </p>

          <p>
            The signature captured below is considered your consent.
          </p>
        </div>

        <label style={styles.checkbox}>
          <input type="checkbox" defaultChecked />
          &nbsp;I have read and agree to the terms.
        </label>

        <h3 style={{ marginTop: 30 }}>Draw Your Signature</h3>

        <div style={styles.signatureBox}>
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{
              width: 700,
              height: 220,
              style: {
                width: "100%",
                height: "220px",
              },
            }}
          />
        </div>

        <div style={styles.buttons}>
          <button style={styles.clear} onClick={clearSignature}>
            Clear
          </button>

          <button style={styles.save} onClick={saveSignature}>
            Save Signature
          </button>

          <button
            style={styles.download}
            onClick={downloadSignature}
            disabled={!signature}
          >
            Download
          </button>
        </div>

        {signature && (
          <>
            <h3 style={{ marginTop: 30 }}>Preview</h3>

            <img
              src={signature}
              alt="Signature Preview"
              style={styles.preview}
            />
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f5f7",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    fontFamily: "Arial",
  },

  card: {
    width: "850px",
    background: "#fff",
    borderRadius: 12,
    padding: 30,
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  },

  agreement: {
    background: "#fafafa",
    border: "1px solid #ddd",
    padding: 20,
    borderRadius: 8,
    lineHeight: 1.7,
  },

  checkbox: {
    display: "flex",
    alignItems: "center",
    marginTop: 20,
    fontSize: 15,
  },

  signatureBox: {
    border: "2px dashed #999",
    borderRadius: 10,
    marginTop: 15,
    overflow: "hidden",
    background: "#fff",
  },

  buttons: {
    display: "flex",
    gap: 15,
    marginTop: 20,
  },

  clear: {
    padding: "12px 22px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  save: {
    padding: "12px 22px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  download: {
    padding: "12px 22px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  preview: {
    marginTop: 20,
    border: "1px solid #ddd",
    width: 300,
    background: "#fff",
  },
};
