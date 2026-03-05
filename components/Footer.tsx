import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Footer: React.FC = () => {
  const { theme } = useTheme();

  return (
    <footer 
      className="text-white pt-12 pb-8 transition-colors duration-300"
      style={{ backgroundColor: theme.footerColor || '#111827' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-2xl font-bold tracking-wider mb-4 text-orange-500">
              {theme.headerText || 'CraveWave'}
            </h3>
            <p className="text-gray-400 text-sm">
              Delivering happiness to your doorstep. The best local restaurants at the touch of a button.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition">About Us</a></li>
              <li><a href="#" className="hover:text-white transition">Careers</a></li>
              <li><a href="#" className="hover:text-white transition">Team</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Help & Support</li>
              <li>Partner with us</li>
              <li>Ride with us</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Terms & Conditions</li>
              <li>Refund & Cancellation</li>
              <li>Privacy Policy</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">{theme.footerText || '© 2024 CraveWave Technologies Inc.'}</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href={theme.socialLinks?.facebook || '#'} target="_blank" rel="noopener noreferrer">
              <Facebook className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
            </a>
            <a href={theme.socialLinks?.instagram || '#'} target="_blank" rel="noopener noreferrer">
              <Instagram className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
            </a>
            {theme.socialLinks?.twitter && (
              <a href={theme.socialLinks.twitter} target="_blank" rel="noopener noreferrer">
                <Twitter className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
              </a>
            )}
            {theme.socialLinks?.linkedin && (
              <a href={theme.socialLinks.linkedin} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
