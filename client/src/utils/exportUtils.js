import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Format currency amount for Indian Rupee display
 */
export const formatINR = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);
};

/**
 * Format currency amount for PDF export without font encoding / glyph errors
 */
export const formatPdfCurrency = (amount) => {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
};

/**
 * Format date in IST
 */
export const formatISTDate = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
};

/**
 * Format timestamp in IST
 */
export const formatISTDateTime = (date) => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(date);
  }
};

/**
 * Format duration helper
 */
export const formatDuration = (val) => {
  if (!val && val !== 0) return "0m";
  let totalSeconds = 0;
  if (val > 50000) {
    totalSeconds = Math.floor(val / 1000);
  } else {
    totalSeconds = Math.floor(val);
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/**
 * Export report to professional PDF (A4 format, D-Mart / Supermarket POS style)
 */
export const exportReportToPDF = ({
  title = "Report",
  category = "Report Category",
  period = "All Time",
  filters = {},
  kpis = [],
  columns = [],
  data = [],
}) => {
  // Use landscape if table has many columns (> 6)
  const orientation = columns.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const nowStr = formatISTDateTime(new Date());

  // Top Header Banner
  doc.setFillColor(79, 70, 229); // Primary Indigo #4F46E5
  doc.rect(0, 0, pageWidth, 20, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SMART POS & INVENTORY MANAGEMENT SYSTEM", 14, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Official Business Report  |  ${category.toUpperCase()}`, 14, 15);

  const rightMargin = pageWidth - 14;
  doc.text(`Generated: ${nowStr} IST`, rightMargin, 15, { align: "right" });

  let y = 28;

  // Title and Subtitle
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Period: ${period}`, 14, y + 5);

  y += 12;

  // Filters Block if any
  const filterEntries = Object.entries(filters).filter(
    ([_, v]) => v !== undefined && v !== null && v !== "" && v !== "all" && (!Array.isArray(v) || v.length > 0)
  );

  if (filterEntries.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, pageWidth - 28, 11, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("APPLIED FILTERS:", 17, y + 5);

    const filterText = filterEntries
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("  |  ");
    doc.setFont("helvetica", "normal");
    doc.text(filterText.length > 130 ? filterText.substring(0, 130) + "..." : filterText, 45, y + 5);

    y += 15;
  }

  // KPI Summary Cards
  if (kpis && kpis.length > 0) {
    const cardCount = Math.min(kpis.length, 5);
    const cardGap = 3;
    const totalAvailWidth = pageWidth - 28;
    const cardWidth = (totalAvailWidth - cardGap * (cardCount - 1)) / cardCount;
    const cardHeight = 16;

    kpis.slice(0, cardCount).forEach((kpi, idx) => {
      const cardX = 14 + idx * (cardWidth + cardGap);
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(kpi.label || "").toUpperCase(), cardX + 3, y + 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      let valStr = String(kpi.value !== undefined && kpi.value !== null ? kpi.value : "0");
      if (kpi.format === "currency") {
        valStr = formatPdfCurrency(kpi.value);
      } else {
        valStr = valStr.replace(/₹/g, "Rs. ");
      }
      doc.text(valStr, cardX + 3, y + 12);
    });

    y += cardHeight + 6;
  }

  // Table
  const head = [columns.map((c) => c.header)];
  const body = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (c.format === "currency") return formatPdfCurrency(val);
      if (c.format === "duration") return formatDuration(val);
      if (c.format === "date") return formatISTDate(val);
      if (c.format === "datetime") return formatISTDateTime(val);
      if (c.format === "percent") return `${Number(val || 0).toFixed(1)}%`;
      const strVal = val !== undefined && val !== null ? String(val) : "-";
      return strVal.replace(/₹/g, "Rs. ");
    })
  );

  // Column alignment configuration
  const columnStyles = {};
  columns.forEach((c, i) => {
    if (c.format === "currency" || c.align === "right") {
      columnStyles[i] = { halign: "right" };
    } else if (c.align === "center" || c.format === "duration" || c.format === "percent") {
      columnStyles[i] = { halign: "center" };
    } else {
      columnStyles[i] = { halign: "left" };
    }
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate #1E293B
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles,
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawPage: (pageData) => {
      // Footer on every page
      const current = pageData.pageNumber;
      const total = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Smart POS & Inventory Management System  •  Confidential Retail Report`,
        14,
        pageHeight - 8
      );
      doc.text(`Page ${current} of ${total}`, pageWidth - 14, pageHeight - 8, {
        align: "right",
      });
    },
  });

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};

/**
 * Export report to real Excel .xlsx file with Summary & Detail sheets
 */
export const exportReportToExcel = ({
  title = "Report",
  category = "Report Category",
  period = "All Time",
  filters = {},
  kpis = [],
  columns = [],
  data = [],
}) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Report Summary
  const summaryRows = [
    ["SMART POS & INVENTORY MANAGEMENT SYSTEM"],
    ["REPORT SUMMARY"],
    [],
    ["Report Title", title],
    ["Category", category],
    ["Report Period", period],
    ["Generated At", formatISTDateTime(new Date()) + " IST"],
    [],
    ["APPLIED FILTERS"],
  ];

  const filterEntries = Object.entries(filters).filter(
    ([_, v]) => v !== undefined && v !== null && v !== "" && v !== "all" && (!Array.isArray(v) || v.length > 0)
  );

  if (filterEntries.length > 0) {
    filterEntries.forEach(([k, v]) => {
      summaryRows.push([k, Array.isArray(v) ? v.join(", ") : String(v)]);
    });
  } else {
    summaryRows.push(["Filters", "None (All records included)"]);
  }

  summaryRows.push([]);
  summaryRows.push(["KEY PERFORMANCE INDICATORS (KPIs)"]);
  summaryRows.push(["Metric", "Value"]);
  if (kpis && kpis.length > 0) {
    kpis.forEach((kpi) => {
      summaryRows.push([kpi.label, kpi.value]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Report Summary");

  // Sheet 2: Detailed Data
  const detailHeaders = columns.map((c) => c.header);
  const detailRows = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (c.format === "currency") return Number(val) || 0;
      if (c.format === "duration") return formatDuration(val);
      if (c.format === "date") return formatISTDate(val);
      if (c.format === "datetime") return formatISTDateTime(val);
      if (c.format === "percent") return `${Number(val || 0).toFixed(1)}%`;
      return val !== undefined && val !== null ? val : "";
    })
  );

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  // Set automatic column widths
  const colWidths = columns.map((c) => ({
    wch: Math.max(c.header.length + 4, 14),
  }));
  wsDetail["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsDetail, "Detailed Data");

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Export report to UTF-8 CSV with BOM for universal Excel compatibility
 */
export const exportReportToCSV = ({
  title = "Report",
  columns = [],
  data = [],
}) => {
  const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        let val = row[c.key];
        if (c.format === "currency") val = Number(val) || 0;
        else if (c.format === "duration") val = formatDuration(val);
        else if (c.format === "date") val = formatISTDate(val);
        else if (c.format === "datetime") val = formatISTDateTime(val);
        else if (c.format === "percent") val = `${Number(val || 0).toFixed(1)}%`;
        if (val === undefined || val === null) val = "";
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(",")
  );

  const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Trigger clean window print
 */
export const printReport = () => {
  window.print();
};
