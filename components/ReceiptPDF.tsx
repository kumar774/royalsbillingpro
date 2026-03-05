import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { Restaurant, Order, LastOrderDetails } from '../types';

export const generateProfessionalReceipt = (
    order: Order | LastOrderDetails, 
    restaurant: Restaurant, 
    action: 'print' | 'download'
) => {
    // Determine paper size based on settings
    const sizeStr = restaurant.selectedPrinterSize || '80mm Thermal';
    
    let pageWidth = 80; // Default 80mm
    const unit: "pt" | "px" | "in" | "mm" | "cm" | "ex" | "em" | "pc" = 'mm';
    let docFormat: string | number[] = [80, 200];
    let fontSizeNormal = 9;
    let fontSizeLarge = 14;
    let fontSizeSmall = 7;
    let margin = 5;

    if (sizeStr === '58mm Thermal' || sizeStr === '2-inch') {
        pageWidth = 58;
        docFormat = [58, 200];
        fontSizeNormal = 8;
        fontSizeLarge = 12;
        fontSizeSmall = 6;
        margin = 3;
    } else if (sizeStr === 'A4') {
        pageWidth = 210;
        docFormat = 'a4';
        fontSizeNormal = 12;
        fontSizeLarge = 20;
        fontSizeSmall = 10;
        margin = 15;
    } else if (sizeStr === 'A5') {
        pageWidth = 148;
        docFormat = 'a5';
        fontSizeNormal = 10;
        fontSizeLarge = 16;
        fontSizeSmall = 8;
        margin = 10;
    } else if (sizeStr === '3-inch') {
        pageWidth = 76; // ~3 inches
        docFormat = [76, 200];
        fontSizeNormal = 9;
        fontSizeLarge = 14;
        fontSizeSmall = 7;
        margin = 4;
    } else if (sizeStr === '4-inch') {
        pageWidth = 101; // ~4 inches
        docFormat = [101, 200];
        fontSizeNormal = 10;
        fontSizeLarge = 16;
        fontSizeSmall = 8;
        margin = 5;
    } else if (sizeStr === 'Legal') {
        pageWidth = 216; // 8.5 inches
        docFormat = 'legal';
        fontSizeNormal = 12;
        fontSizeLarge = 20;
        fontSizeSmall = 10;
        margin = 15;
    } else if (sizeStr === 'Letter') {
        pageWidth = 216; // 8.5 inches
        docFormat = 'letter';
        fontSizeNormal = 12;
        fontSizeLarge = 20;
        fontSizeSmall = 10;
        margin = 15;
    } else if (sizeStr === 'Continuous') {
        pageWidth = 80;
        docFormat = [80, 200];
    }

    const doc = new jsPDF({
        unit: unit,
        format: docFormat
    });
    
    const contentWidth = pageWidth - (margin * 2);
    let y = margin + 5;

    // Header
    doc.setFontSize(fontSizeLarge);
    doc.setFont("courier", "bold");
    doc.text(restaurant.name, pageWidth / 2, y, { align: "center" });
    y += fontSizeLarge * 0.5;
    
    doc.setFontSize(fontSizeSmall);
    doc.setFont("courier", "normal");
    
    const settings = restaurant.restaurantPageSettings;
    const address = settings?.header.address || restaurant.location;
    const phone = settings?.header.phone || restaurant.contact;

    if (address) {
        const addressLines = doc.splitTextToSize(address, contentWidth);
        doc.text(addressLines, pageWidth / 2, y, { align: "center" });
        y += (addressLines.length * fontSizeSmall * 0.4);
    }
    
    if (phone) {
        doc.text(`Tel: ${phone}`, pageWidth / 2, y, { align: "center" });
        y += fontSizeSmall * 0.6;
    }
    
    y += 2; // Extra spacing before order info
    
    // Order Info
    doc.setFontSize(fontSizeNormal);
    doc.setFont("courier", "normal");
    
    const orderId = order.formattedId || order.id.slice(0, 6);
    doc.text(`Order ID: ${orderId}`, margin, y);
    y += fontSizeNormal * 0.5;
    
    const orderDateRaw = 'createdAt' in order ? order.createdAt : order.date;
    const orderDate = orderDateRaw ? format(new Date(orderDateRaw), "dd/MM/yyyy, hh:mm a") : 'Invalid Date';
    doc.text(`Date: ${orderDate}`, margin, y);
    y += fontSizeNormal * 0.5;
    
    doc.text(`Type: ${order.orderType}`, margin, y);
    y += fontSizeNormal * 0.5;

    // Payment Info
    doc.text(`Payment Mode: ${order.paymentMethod || 'Online'}`, margin, y);
    y += fontSizeNormal * 0.5;
    
    const paymentStatus = ('paymentStatus' in order ? order.paymentStatus : (order.paymentMethod === 'Cash' ? 'PENDING' : 'PAID'))?.toUpperCase() || 'PENDING';
    doc.text(`Payment Status: ${paymentStatus}`, margin, y);
    y += fontSizeNormal * 0.8;
    
    // Divider
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    y += fontSizeNormal * 0.6;

    // Items Header
    doc.setFont("helvetica", "bold");
    doc.text("Item", margin, y);
    doc.text("Price", pageWidth - margin, y, { align: 'right' });
    y += fontSizeNormal * 0.6;
    doc.setFont("helvetica", "normal");

    // Items
    order.items.forEach(item => {
        const itemName = `${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''}`;
        const price = ((item.selectedVariant?.price || item.price) * item.quantity).toFixed(2);
        
        const splitName = doc.splitTextToSize(itemName, contentWidth - 20);
        doc.text(splitName, margin, y);
        
        const priceY = y + (splitName.length - 1) * (fontSizeNormal * 0.4);
        doc.setFont("courier", "normal");
        doc.text(`Rs.${price}`, pageWidth - margin, priceY, { align: 'right' });
        doc.setFont("helvetica", "normal");
        
        y += (splitName.length * (fontSizeNormal * 0.4)) + 2;
    });

    y += fontSizeNormal * 0.4;
    doc.line(margin, y, pageWidth - margin, y);
    y += fontSizeNormal * 0.6;
    
    // Totals
    const subtotal = order.subtotal || order.total;
    doc.text("Subtotal:", margin, y);
    doc.setFont("courier", "normal");
    doc.text(`Rs.${subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    doc.setFont("helvetica", "normal");
    y += fontSizeNormal * 0.5;

    const discount = order.discount || 0;
    if (discount > 0) {
        doc.text("Discount:", margin, y);
        doc.setFont("courier", "normal");
        doc.text(`-Rs.${discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        y += fontSizeNormal * 0.5;
    }

    const deliveryCharge = ('deliveryCharge' in order ? order.deliveryCharge : order.deliveryFee) || 0;
    if (deliveryCharge > 0) {
        doc.text("Delivery:", margin, y);
        doc.setFont("courier", "normal");
        doc.text(`Rs.${deliveryCharge.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        y += fontSizeNormal * 0.5;
    }

    const taxDetails = order.taxDetails || { gstAmount: 0, serviceAmount: 0, gstRate: 0, serviceRate: 0 };
    if (taxDetails.gstAmount > 0) {
        doc.text(`GST (${taxDetails.gstRate || 5}%):`, margin, y);
        doc.setFont("courier", "normal");
        doc.text(`Rs.${taxDetails.gstAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        y += fontSizeNormal * 0.5;
    }

    if (taxDetails.serviceAmount > 0) {
        doc.text(`Service (${taxDetails.serviceRate || 0}%):`, margin, y);
        doc.setFont("courier", "normal");
        doc.text(`Rs.${taxDetails.serviceAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        y += fontSizeNormal * 0.8;
    }

    // Grand Total
    doc.setFontSize(fontSizeNormal + 2);
    doc.setFont("helvetica", "bold");
    doc.text("Total Payable:", margin, y);
    doc.setFont("courier", "bold");
    doc.text(`Rs.${order.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    doc.setFont("helvetica", "bold");
    y += fontSizeLarge * 0.8;
    
    // Footer
    doc.setFontSize(fontSizeNormal);
    doc.setFont("helvetica", "italic");
    const footerText = restaurant.receiptFooter || `Thank you for visiting ${restaurant.name}`;
    
    const splitFooter = doc.splitTextToSize(footerText, contentWidth);
    doc.text(splitFooter, pageWidth / 2, y, { align: "center" });
    y += (splitFooter.length * (fontSizeNormal * 0.5));
    
    doc.setFontSize(fontSizeSmall);
    doc.text("Generated by CraveWave POS", pageWidth / 2, y, { align: "center" });

    if (action === 'print') {
        doc.autoPrint();
        doc.output('dataurlnewwindow');
    } else {
        doc.save(`receipt_${orderId}.pdf`);
    }
};
