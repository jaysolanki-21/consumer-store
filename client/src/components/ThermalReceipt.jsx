import React, { forwardRef } from "react";

const ThermalReceipt = forwardRef(({ order, counter }, ref) => {
  if (!order) return null;

  const {
    _id,
    items = [],
    totalAmount = 0,
    amountReceived = 0,
    changeGiven = 0,
    paymentMethod = "CASH",
    createdAt,
    customerName,
  } = order;

  const subtotal = items.reduce(
    (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
    0,
  );

  const formatDate = (d) => {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (d) => {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const billNo = `#${String(_id || "").slice(-6).toUpperCase() || "000000"}`;
  const counterName = counter?.counterName || "Counter 1";
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <div
      ref={ref}
      className="thermal-receipt"
      style={{
        width: "80mm",
        padding: "6mm 3mm",
        background: "#fff",
        color: "#000",
        fontFamily: "'Courier New', 'Consolas', monospace",
        fontSize: "12px",
        lineHeight: 1.35,
        margin: "0 auto",
      }}
    >
      {/* ===== HEADER ===== */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            letterSpacing: "3px",
          }}
        >
          APC STORE
        </div>
        <div style={{ fontSize: "10px", marginTop: "3px" }}>
          Automatic Purchase Counter
        </div>
        <div style={{ fontSize: "10px" }}>GSTIN: 22AAAAA0000A1Z5</div>
        <div style={{ fontSize: "10px" }}>Ph: +91 98765 43210</div>
      </div>

      <DashedLine />

      {/* ===== META INFO ===== */}
      <div style={{ fontSize: "11px" }}>
        <MetaRow label="Bill No" value={billNo} />
        <MetaRow label="Date" value={formatDate(createdAt)} />
        <MetaRow label="Time" value={formatTime(createdAt)} />
        <MetaRow label="Counter" value={counterName} />
        {customerName && <MetaRow label="Customer" value={customerName} />}
        <MetaRow label="Payment" value={paymentMethod.toUpperCase()} />
      </div>

      <DashedLine />

      {/* ===== ITEMS HEADER ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 26px 58px 62px",
          columnGap: "2px",
          fontWeight: "bold",
          fontSize: "10px",
          borderBottom: "1px solid #000",
          paddingBottom: "3px",
          marginBottom: "4px",
          textTransform: "uppercase",
        }}
      >
        <span>Item</span>
        <span style={{ textAlign: "center" }}>Qty</span>
        <span style={{ textAlign: "right" }}>Rate</span>
        <span style={{ textAlign: "right" }}>Amount</span>
      </div>

      {/* ===== ITEMS ===== */}
      {items.map((item, idx) => {
        const name = item.name || item.productName || `Item ${idx + 1}`;
        const qty = item.quantity || 0;
        const rate = item.price || 0;
        const amt = rate * qty;

        return (
          <div
            key={idx}
            style={{
              marginBottom: "5px",
              paddingBottom: "4px",
              borderBottom: idx < items.length - 1 ? "1px dotted #999" : "none",
            }}
          >
            {/* Row 1: Name full width (wraps naturally) */}
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                wordBreak: "break-word",
                marginBottom: "2px",
              }}
            >
              {name}
            </div>

            {/* Row 2: Qty / Rate / Amt aligned right */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 26px 58px 62px",
                columnGap: "2px",
                fontSize: "11px",
              }}
            >
              <span></span>
              <span style={{ textAlign: "center" }}>{qty}</span>
              <span style={{ textAlign: "right" }}>{rate.toFixed(2)}</span>
              <span style={{ textAlign: "right" }}>{amt.toFixed(2)}</span>
            </div>
          </div>
        );
      })}

      <DashedLine />

      {/* ===== TOTALS ===== */}
      <div style={{ fontSize: "11px" }}>
        <TotalRow label="Subtotal" value={`₹${subtotal.toFixed(2)}`} />
        <TotalRow label="Total Items" value={totalQty} />
      </div>

      <SolidLine />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "15px",
          fontWeight: "bold",
          padding: "2px 0",
        }}
      >
        <span>GRAND TOTAL</span>
        <span>₹{Number(totalAmount).toFixed(2)}</span>
      </div>

      <DashedLine />

      {/* ===== PAYMENT BREAKDOWN ===== */}
      <div style={{ fontSize: "11px" }}>
        {paymentMethod.toLowerCase() === "cash" ? (
          <>
            <TotalRow
              label="Cash Received"
              value={`₹${Number(amountReceived).toFixed(2)}`}
            />
            <TotalRow
              label="Change Returned"
              value={`₹${Number(changeGiven).toFixed(2)}`}
              bold
            />
          </>
        ) : (
          <>
            <TotalRow
              label="Payment Mode"
              value={paymentMethod.toUpperCase()}
            />
            <TotalRow
              label="Payment Status"
              value="PAID"
              bold
            />
          </>
        )}
      </div>

      <DashedLine />

      {/* ===== FOOTER ===== */}
      <div
        style={{
          textAlign: "center",
          marginTop: "10px",
          fontSize: "10px",
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "13px", letterSpacing: "1px" }}>
          *** THANK YOU ***
        </div>
        <div style={{ marginTop: "4px" }}>Visit Again!</div>
        <div style={{ marginTop: "8px", lineHeight: 1.4 }}>
          Items once sold will not be
          <br />
          taken back or exchanged.
        </div>
        <div
          style={{
            marginTop: "8px",
            fontSize: "9px",
            letterSpacing: "1px",
          }}
        >
          -- Powered by APC Store --
        </div>
      </div>

      {/* Barcode-style footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: "10px",
          fontFamily: "monospace",
          fontSize: "14px",
          letterSpacing: "1px",
        }}
      >
        |||| ||| ||||| ||| |||| |||
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: "9px",
          letterSpacing: "2px",
        }}
      >
        {billNo.replace("#", "")}
      </div>
    </div>
  );
});

/* ---------- Helper sub-components ---------- */

const DashedLine = () => (
  <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
);

const SolidLine = () => (
  <div style={{ borderTop: "2px solid #000", margin: "5px 0" }} />
);

const MetaRow = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "2px",
    }}
  >
    <span>{label}</span>
    <span style={{ fontWeight: "bold" }}>{value}</span>
  </div>
);

const TotalRow = ({ label, value, bold }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "2px",
      fontWeight: bold ? "bold" : "normal",
    }}
  >
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

ThermalReceipt.displayName = "ThermalReceipt";
export default ThermalReceipt;