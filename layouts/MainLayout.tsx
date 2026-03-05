import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import { CartProvider } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';

interface MainLayoutProps {
  children: React.ReactNode;
  setShowQrModal: (show: boolean) => void;
  setQrCodeValue: (value: string) => void;
  showQrModal: boolean;
  qrCodeValue: string;
}

import Modal from 'react-modal';
import { QRCodeSVG } from 'qrcode.react';

Modal.setAppElement('#root'); // Set app element for react-modal

const MainLayout: React.FC<MainLayoutProps> = ({ children, setShowQrModal, setQrCodeValue, showQrModal, qrCodeValue }) => {
  const { theme } = useTheme();

  return (
    <CartProvider>
      <div 
        className="flex flex-col min-h-screen bg-gray-50 font-sans text-gray-900"
        style={{ 
          '--primary-color': theme.primaryColor || '#ea580c',
          '--footer-color': theme.footerColor || '#111827',
          '--header-color': theme.headerColor || '#ffffff'
        } as React.CSSProperties}
      >
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
        <CartDrawer setShowQrModal={setShowQrModal} setQrCodeValue={setQrCodeValue} />
      </div>

        {/* QR Code Modal (Lifted from RestaurantFrontPage) */}
        <Modal
          isOpen={showQrModal}
          onRequestClose={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Scan to Pay</h3>
            {qrCodeValue ? (
              <div className="flex justify-center mb-6">
                <QRCodeSVG value={qrCodeValue} size={200} />
              </div>
            ) : (
              <p className="text-red-500 mb-6">QR Code not available.</p>
            )}
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
            >
              Close
            </button>
          </div>
        </Modal>
      </CartProvider>
  );
};

export default MainLayout;
