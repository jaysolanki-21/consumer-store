import { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import {
  FiCalendar,
  FiDollarSign,
  FiShoppingBag,
  FiPackage,
  FiUserCheck,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesReportPage() {
  // Get today's date in Indian Standard Time (IST) as YYYY-MM-DD
  const getTodayIST = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  };

  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [salesData, setSalesData] = useState({
    date: "",
    totalOrders: 0,
    totalIncome: 0,
    productWise: [],
  });
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchSalesReport();
    fetchConfirmedOrders();
  }, [selectedDate]);

  useEffect(() => {
    const handleOrderChange = () => {
      fetchSalesReport();
      fetchConfirmedOrders();
    };

    socket.on("orderConfirmed", handleOrderChange);
    socket.on("orderCancelled", handleOrderChange);
    socket.on("newOrder", handleOrderChange);

    return () => {
      socket.off("orderConfirmed", handleOrderChange);
      socket.off("orderCancelled", handleOrderChange);
      socket.off("newOrder", handleOrderChange);
    };
  }, [selectedDate]);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/orders/sales-report?date=${selectedDate}`
      );
      setSalesData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sales report");
      setSalesData({
        date: selectedDate,
        totalOrders: 0,
        totalIncome: 0,
        productWise: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfirmedOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data } = await api.get("/orders");
      const startDate = new Date(`${selectedDate}T00:00:00.000+05:30`);
      const endDate = new Date(`${selectedDate}T23:59:59.999+05:30`);
      const filtered = data.filter(
        (order) =>
          order.status === "Confirmed" &&
          new Date(order.createdAt) >= startDate &&
          new Date(order.createdAt) <= endDate
      );
      setConfirmedOrders(filtered);
    } catch (err) {
      toast.error("Failed to load confirmed orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const handlePrevDay = () => {
    setSelectedDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    const todayIST = getTodayIST();
    const newDate = addDays(selectedDate, 1);
    if (newDate <= todayIST) {
      setSelectedDate(newDate);
    } else {
      toast.error("Cannot go beyond today");
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const todayIST = getTodayIST();
    if (newDate > todayIST) {
      toast.error("Cannot select a future date (IST)");
      return;
    }
    setSelectedDate(newDate);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ─── PDF Download ──────────────────────────────────────────────────────────
  const downloadPDF = () => {
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;

      // ── Header bar ──
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Sales Report", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        pageW - margin,
        13,
        { align: "right" }
      );
      doc.text(formatDate(selectedDate), pageW - margin, 20, { align: "right" });

      let y = 36;

      // ── Summary cards (3 columns) ──
      const cardW = (contentW - 8) / 3;
      const cards = [
        {
          label: "Report Date",
          value: formatDate(selectedDate),
          color: [79, 70, 229],
          small: true,
        },
        {
          label: "Total Income",
          value: `Rs. ${(salesData.totalIncome || 0).toLocaleString("en-IN")}`,
          color: [16, 185, 129],
        },
        {
          label: "Confirmed Orders",
          value: String(salesData.totalOrders || 0),
          color: [124, 58, 237],
        },
      ];

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 4);
        doc.setFillColor(card.color[0], card.color[1], card.color[2]);
        doc.roundedRect(x, y, cardW, 22, 3, 3, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(card.label, x + 5, y + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(card.small ? 9 : 13);
        const valLines = doc.splitTextToSize(card.value, cardW - 8);
        doc.text(valLines, x + 5, y + 15);
      });

      y += 30;

      // ── Section: Product-wise Sales ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text("Product-wise Sales", margin, y);
      y += 5;

      if (!salesData.productWise || salesData.productWise.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No product sales for this date.", margin, y + 6);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Product Name", "Qty Sold", "Revenue (Rs.)"]],
          body: salesData.productWise.map((item, idx) => [
            idx + 1,
            item.name,
            item.quantity,
            Number(item.revenue).toLocaleString("en-IN"),
          ]),
          foot: [
            [
              "",
              "TOTAL",
              salesData.productWise.reduce((s, i) => s + i.quantity, 0),
              `Rs. ${(salesData.totalIncome || 0).toLocaleString("en-IN")}`,
            ],
          ],
          headStyles: {
            fillColor: [79, 70, 229],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          footStyles: {
            fillColor: [238, 242, 255],
            textColor: [31, 41, 55],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          bodyStyles: { fontSize: 9, textColor: [31, 41, 55], halign: "center" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { halign: "left" },
            2: { halign: "center" },
            3: { halign: "right" },
          },
          showFoot: "lastPage",
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── Section: Confirmed Orders ──
      if (y > pageH - 60) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text("Confirmed Orders Details", margin, y);
      y += 5;

      if (confirmedOrders.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No confirmed orders for this date.", margin, y + 6);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Order ID", "Time", "Roll No.", "Amount (Rs.)", "Approved By"]],
          body: confirmedOrders.map((order, idx) => [
            idx + 1,
            `#${order._id.slice(-8)}`,
            new Date(order.createdAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: true,
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "short",
            }),
            order.rollNumber,
            `Rs. ${Number(order.totalAmount).toLocaleString("en-IN")}`,
            order.confirmedBy?.name || "System",
          ]),
          foot: [
            [
              "",
              "",
              "",
              `${confirmedOrders.length} Orders`,
              `Rs. ${confirmedOrders
                .reduce((s, o) => s + Number(o.totalAmount), 0)
                .toLocaleString("en-IN")}`,
              "",
            ],
          ],
          headStyles: {
            fillColor: [124, 58, 237],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          footStyles: {
            fillColor: [245, 243, 255],
            textColor: [31, 41, 55],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          bodyStyles: { fontSize: 9, textColor: [31, 41, 55], halign: "center" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { halign: "center" },
            2: { halign: "center" },
            3: { halign: "center" },
            4: { halign: "right" },
            5: { halign: "center" },
          },
          showFoot: "lastPage",
        });
      }

      // ── Footer on every page ──
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text("Consumer Store – Confidential", margin, pageH - 7);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7, {
          align: "right",
        });
      }

      const fileName = `Sales_Report_${selectedDate}.pdf`;
      doc.save(fileName);
      toast.success(`Report downloaded: ${fileName}`);
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Sales Report</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm">
            <button
              onClick={handlePrevDay}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
              title="Previous day"
            >
              <FiChevronLeft className="text-indigo-500" />
            </button>
            <FiCalendar className="text-indigo-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              max={getTodayIST()}
              className="bg-transparent outline-none"
            />
            <button
              onClick={handleNextDay}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
              title="Next day"
            >
              <FiChevronRight className="text-indigo-500" />
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={downloadPDF}
            disabled={downloadingPdf || loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-200 font-medium text-sm"
            title="Download PDF report"
          >
            {downloadingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FiDownload className="text-base" />
                Download Report
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Report Date</p>
                  <p className="text-lg font-semibold mt-1">{formatDate(selectedDate)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiCalendar className="text-2xl text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Income</p>
                  <p className="text-2xl font-bold mt-1">
                    ₹{(salesData.totalIncome || 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FaRupeeSign className="text-2xl text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Confirmed Orders</p>
                  <p className="text-2xl font-bold mt-1">{salesData.totalOrders || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiShoppingBag className="text-2xl text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Product-wise Sales Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiPackage /> Product-wise Sales
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-center">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Product</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Quantity Sold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!salesData.productWise || salesData.productWise.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        No sales for this date.
                      </td>
                    </tr>
                  ) : (
                    salesData.productWise.map((item) => (
                      <tr key={item.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white text-left">{item.name}</td>
                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">{item.quantity}</td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">
                          ₹{item.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {salesData.productWise && salesData.productWise.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <tr>
                      <td className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">TOTAL</td>
                      <td className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                        {salesData.productWise.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-green-700 dark:text-green-300">
                        ₹{(salesData.totalIncome || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Confirmed Orders Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiUserCheck /> Confirmed Orders Details
              </h2>
            </div>
            {loadingOrders ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr className="text-center">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Order ID</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Time</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Roll Number</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Amount</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {confirmedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          No confirmed orders for this date.
                        </td>
                      </tr>
                    ) : (
                      confirmedOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                          <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white text-left">
                            #{order._id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-center">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-200">
                            {order.rollNumber}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">
                            ₹{order.totalAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium">
                              <FiUserCheck size={12} />
                              {order.confirmedBy?.name || "System"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {confirmedOrders.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                      <tr>
                        <td colSpan="3" className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          TOTAL:
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-green-700 dark:text-green-300">
                          ₹{confirmedOrders.reduce((s, o) => s + Number(o.totalAmount), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-center text-sm text-gray-500">
                          {confirmedOrders.length} Orders
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}