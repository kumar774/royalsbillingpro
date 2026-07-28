import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { Restaurant, Order, LastOrderDetails } from '../types';
import QRCode from 'qrcode';

export const generateProfessionalReceipt = async (
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
    let fontSizeLarge = 13;
    let fontSizeSmall = 7;
    let margin = 5;

    if (sizeStr === '58mm Thermal' || sizeStr === '2-inch') {
        pageWidth = 58;
        docFormat = [58, 200];
        fontSizeNormal = 8;
        fontSizeLarge = 11;
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
        fontSizeLarge = 13;
        fontSizeSmall = 7;
        margin = 4;
    } else if (sizeStr === '4-inch') {
        pageWidth = 101; // ~4 inches
        docFormat = [101, 200];
        fontSizeNormal = 10;
        fontSizeLarge = 15;
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

    const contentWidth = pageWidth - (margin * 2);

    // 1. Generate UPI Payment QR code if UPI ID is configured
    let qrCodeDataUrl = '';
    if (restaurant.upiId) {
        try {
            const upiUrl = `upi://pay?pa=${restaurant.upiId}&pn=${encodeURIComponent(restaurant.name)}&am=${order.total.toFixed(2)}&cu=INR`;
            qrCodeDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 120 });
        } catch (err) {
            console.error("Failed to generate UPI QR code for receipt PDF:", err);
        }
    }

    // 2. Calculate dynamic height for thermal printers to prevent trailing blank space
    const address = restaurant.location || '';
    const phone = restaurant.contact || '';
    const receiptFooter = restaurant.receiptFooter || `Thank you for visiting ${restaurant.name}`;

    let estimatedHeight = margin * 2;
    
    // Header
    estimatedHeight += 12; 
    if (address) {
        const charsPerLine = pageWidth > 60 ? 35 : 25;
        const addrLines = Math.ceil(address.length / charsPerLine);
        estimatedHeight += addrLines * 4.5;
    }
    if (phone) estimatedHeight += 4.5;
    
    // Order details info
    estimatedHeight += 6; 
    estimatedHeight += 25; 
    
    // Customer Info
    const customerName = 'customerName' in order ? order.customerName : '';
    const customerPhone = 'customerPhone' in order ? order.customerPhone : '';
    if (customerName || customerPhone) {
        estimatedHeight += 5;
    }

    if (order.orderType === 'Delivery' && 'deliveryAddress' in order && order.deliveryAddress) {
        const charsPerLine = pageWidth > 60 ? 35 : 25;
        const addrLines = Math.ceil(order.deliveryAddress.length / charsPerLine);
        estimatedHeight += addrLines * 4.5;
    }

    if ('aadhaarNumber' in order && order.aadhaarNumber) {
        const charsPerLine = pageWidth > 60 ? 35 : 25;
        const aadhaarLines = Math.ceil(order.aadhaarNumber.length / charsPerLine);
        estimatedHeight += aadhaarLines * 4.5;
    }
    
    // Divider + Items Header + Divider
    estimatedHeight += 12;
    
    // Items List
    order.items.forEach(item => {
        const itemName = `${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''}`;
        const charsPerLine = pageWidth > 60 ? 30 : 20;
        const itemLines = Math.ceil(itemName.length / charsPerLine);
        estimatedHeight += itemLines * 4.5 + 2;
    });
    
    // Divider + totals
    estimatedHeight += 12;
    if (order.discount && order.discount > 0) estimatedHeight += 4.5;
    const deliveryCharge = ('deliveryCharge' in order ? (order as any).deliveryCharge : (order as any).deliveryFee) || 0;
    if (deliveryCharge > 0) estimatedHeight += 4.5;
    
    const taxDetails = order.taxDetails || { gstAmount: 0, serviceAmount: 0 };
    if (taxDetails.gstAmount > 0) estimatedHeight += 4.5;
    if (taxDetails.serviceAmount > 0) estimatedHeight += 4.5;
    
    // UPI QR Code space
    if (qrCodeDataUrl) {
        estimatedHeight += 38;
    }
    
    // Footer notes
    const footerChars = pageWidth > 60 ? 40 : 30;
    const footerLines = Math.ceil(receiptFooter.length / footerChars);
    estimatedHeight += footerLines * 4.5 + 8;
    
    // Apply final dynamic height if thermal size is chosen
    const isThermal = sizeStr.includes('Thermal') || sizeStr.includes('inch') || sizeStr === 'Continuous';
    const finalFormat = isThermal ? [pageWidth, Math.max(estimatedHeight, 120)] : docFormat;

    const doc = new jsPDF({
        unit: unit,
        format: finalFormat
    });
    
    let y = margin + 5;

    // Header
    doc.setFontSize(fontSizeLarge);
    doc.setFont("courier", "bold");
    doc.text(restaurant.name, pageWidth / 2, y, { align: "center" });
    y += fontSizeLarge * 0.4;
    
    doc.setFontSize(fontSizeSmall);
    doc.setFont("courier", "normal");

    if (address) {
        const addressLines = doc.splitTextToSize(address, contentWidth);
        doc.text(addressLines, pageWidth / 2, y, { align: "center" });
        y += (addressLines.length * fontSizeSmall * 0.4);
    }
    
    if (phone) {
        doc.text(`Tel: ${phone}`, pageWidth / 2, y, { align: "center" });
        y += fontSizeSmall * 0.6;
    }
    
    y += 2; // Extra spacing
    
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

    if (customerName || customerPhone) {
        let customerText = "Customer: ";
        if (customerName) customerText += customerName;
        if (customerPhone) customerText += customerName ? ` (${customerPhone})` : customerPhone;
        
        const splitCustomer = doc.splitTextToSize(customerText, contentWidth);
        doc.text(splitCustomer, margin, y);
        y += (splitCustomer.length * fontSizeNormal * 0.5);
    }

    if (order.orderType === 'Delivery' && 'deliveryAddress' in order && order.deliveryAddress) {
        const addressText = `Address: ${order.deliveryAddress}`;
        const splitAddress = doc.splitTextToSize(addressText, contentWidth);
        doc.text(splitAddress, margin, y);
        y += (splitAddress.length * fontSizeNormal * 0.4) + 1;
    }

    if ('aadhaarNumber' in order && order.aadhaarNumber) {
        const aadhaarText = `Aadhaar: ${order.aadhaarNumber}`;
        const splitAadhaar = doc.splitTextToSize(aadhaarText, contentWidth);
        doc.text(splitAadhaar, margin, y);
        y += (splitAadhaar.length * fontSizeNormal * 0.4) + 1;
    }

    // Payment Info
    doc.text(`Payment Mode: ${order.paymentMethod || 'Online'}`, margin, y);
    y += fontSizeNormal * 0.5;
    
    const paymentStatus = ('paymentStatus' in order ? order.paymentStatus : (order.paymentMethod === 'Cash' ? 'PENDING' : 'PAID'))?.toUpperCase() || 'PENDING';
    doc.text(`Payment Status: ${paymentStatus}`, margin, y);
    y += fontSizeNormal * 0.7;
    
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

    // Currency representation to prevent Unicode encoding errors
    const currencySymbol = ((restaurant as any).currency === '₹' || !(restaurant as any).currency) ? 'Rs.' : (restaurant as any).currency;

    // Items list
    order.items.forEach(item => {
        const itemName = `${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''}`;
        const price = ((item.selectedVariant?.price || item.price) * item.quantity).toFixed(2);
        
        doc.setFont("courier", "normal");
        const splitName = doc.splitTextToSize(itemName, contentWidth - 20);
        doc.text(splitName, margin, y);
        
        const priceY = y + (splitName.length - 1) * (fontSizeNormal * 0.4);
        doc.text(`${currencySymbol}${price}`, pageWidth - margin, priceY, { align: 'right' });
        
        y += (splitName.length * (fontSizeNormal * 0.4)) + 2;
    });

    y += fontSizeNormal * 0.3;
    doc.line(margin, y, pageWidth - margin, y);
    y += fontSizeNormal * 0.6;
    
    // Totals
    const subtotal = order.subtotal || order.total;
    doc.setFont("courier", "normal");
    doc.text("Subtotal:", margin, y);
    doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += fontSizeNormal * 0.5;

    const discount = order.discount || 0;
    if (discount > 0) {
        doc.text("Discount:", margin, y);
        doc.text(`-${currencySymbol}${discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        y += fontSizeNormal * 0.5;
    }

    if (deliveryCharge > 0) {
        doc.text("Delivery:", margin, y);
        doc.text(`${currencySymbol}${deliveryCharge.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        y += fontSizeNormal * 0.5;
    }

    if (taxDetails.gstAmount > 0) {
        doc.text(`GST (${taxDetails.gstRate || 5}%):`, margin, y);
        doc.text(`${currencySymbol}${taxDetails.gstAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        y += fontSizeNormal * 0.5;
    }

    if (taxDetails.serviceAmount > 0) {
        doc.text(`Service (${taxDetails.serviceRate || 0}%):`, margin, y);
        doc.text(`${currencySymbol}${taxDetails.serviceAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
        y += fontSizeNormal * 0.5;
    }

    // Grand Total
    doc.setFontSize(fontSizeNormal + 1.5);
    doc.setFont("courier", "bold");
    doc.text("Total Payable:", margin, y);
    doc.text(`${currencySymbol}${order.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += fontSizeLarge * 0.7;
    
    // UPI QR Code if generated
    if (qrCodeDataUrl) {
        const qrSize = 30; // 30mm centered size
        const qrX = (pageWidth - qrSize) / 2;
        doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, qrSize, qrSize);
        y += qrSize + 3;
        
        doc.setFontSize(fontSizeSmall);
        doc.setFont("courier", "bold");
        doc.text("SCAN TO PAY WITH ANY UPI APP", pageWidth / 2, y, { align: "center" });
        y += fontSizeSmall * 0.8;
    }

    // Footer
    doc.setFontSize(fontSizeNormal);
    doc.setFont("courier", "italic");
    
    const splitFooter = doc.splitTextToSize(receiptFooter, contentWidth);
    doc.text(splitFooter, pageWidth / 2, y, { align: "center" });
    y += (splitFooter.length * (fontSizeNormal * 0.5)) + 1;
    
    doc.setFontSize(fontSizeSmall);
    doc.text("Generated by CraveWave POS", pageWidth / 2, y, { align: "center" });

    if (action === 'print') {
        doc.autoPrint();
        doc.output('dataurlnewwindow');
    } else {
        doc.save(`receipt_${orderId}.pdf`);
    }
};
