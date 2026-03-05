import { Order, CartItem } from '../types';

export const sendTelegramMessage = async (botToken: string, chatId: string, messageText: string) => {
  if (!botToken || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};

export const formatOrderMessage = (order: Order, restaurantName: string, title: string = '🆕 New Order Received!') => {
  const date = new Date(order.createdAt).toLocaleString();
  
  let itemsList = '';
  order.items.forEach((item: CartItem) => {
    const variantInfo = item.selectedVariant ? ` (${item.selectedVariant.size})` : '';
    itemsList += `• ${item.name}${variantInfo} x ${item.quantity} - ₹${(Number(item.price) * Number(item.quantity)).toFixed(2)}\n`;
  });

  const taxLines = order.taxDetails 
    ? Object.entries(order.taxDetails).map(([name, amount]) => `<b>${name}:</b> ₹${Number(amount).toFixed(2)}`).join('\n')
    : '';

  const message = `
<b>${title}</b>
<b>Restaurant:</b> ${restaurantName}
<b>Order ID:</b> #${order.formattedId || order.id.slice(-5)}
<b>Date:</b> ${date}

<b>Customer Details:</b>
<b>Name:</b> ${order.customerName || 'Guest'}
<b>Phone:</b> ${order.customerPhone || 'N/A'}
${order.tableNo ? `<b>Table No:</b> ${order.tableNo}\n` : ''}
<b>Order Type:</b> ${order.orderType}

<b>Items:</b>
${itemsList}
<b>Subtotal:</b> ₹${Number(order.subtotal || 0).toFixed(2)}
${order.discount ? `<b>Discount:</b> -₹${Number(order.discount).toFixed(2)}\n` : ''}${order.deliveryCharge ? `<b>Delivery Charge:</b> ₹${Number(order.deliveryCharge).toFixed(2)}\n` : ''}${taxLines}
<b>Total Amount:</b> ₹${Number(order.total).toFixed(2)}

<b>Metadata:</b>
<b>Payment Status:</b> ${order.paymentStatus || 'Pending'}
<b>Payment Mode:</b> ${order.paymentMethod || 'N/A'}
<b>Order Status:</b> ${order.status}
  `;

  return message.trim();
};
