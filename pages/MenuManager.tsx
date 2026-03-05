import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MenuItem, CategoryType } from '../types';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Upload, ChevronDown, Image as ImageLucide, Check, AlertCircle, Scissors, BrainCircuit, FileSpreadsheet } from 'lucide-react';
import Tesseract from 'tesseract.js';
import Badge from '../components/ui/Badge';
import { useRestaurants } from '../context/RestaurantContext';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const MenuManager: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurants } = useRestaurants(); 
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reviewItems, setReviewItems] = useState<Partial<MenuItem>[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'excel' | null>(null);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const [filterCategoryGroup, setFilterCategoryGroup] = useState<string>('All');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
        setIsImportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Form State
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    categoryGroup:'',
    image: 'https://picsum.photos/seed/food/400/300',
    available: true,
  });
  
  const currentRestaurant = restaurants.find(r => r.id === restaurantId);

  useEffect(() => {
    if (!restaurantId) return;

    // Real-time listener for CURRENT dashboard menu items
    const menuRef = collection(db, 'restaurants', restaurantId, 'menu');
    const unsubscribe = onSnapshot(menuRef, (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      setItems(menuData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleOpenModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        ...item,
        customCategory: item.customCategory || '',
        categoryGroup: item.categoryGroup || '',

      });
 
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        categoryGroup: '',
        customCategory: '',
        variants: [],
        image: 'https://picsum.photos/seed/food/400/300',
        available: true,
      });

    }
    setIsModalOpen(true);
  };





  const handleAddCategory = async () => {
    if (!restaurantId || !formData.categoryGroup.trim()) {
      toast.error("Please enter a category name.");
      return;
    }

    const newCategory = formData.categoryGroup.trim();
    if (currentRestaurant?.customCategories?.includes(newCategory)) {
      toast.error("Category already exists.");
      return;
    }

    const toastId = toast.loading("Adding new category...");
    try {
      const restaurantRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(restaurantRef, {
        customCategories: [...(currentRestaurant?.customCategories || []), newCategory]
      });
      toast.success("Category added successfully!", { id: toastId });
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Failed to add category.", { id: toastId });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) {
      toast.error("No restaurant ID found.");
      return;
    }

    const toastId = toast.loading(editingItem ? "Updating item..." : "Adding item...");

    try {
      const itemPayload = {
        ...formData,
        // Ensure price is a number, default to 0 if NaN or undefined
        price: Number(formData.price) || 0,
        categoryGroup: formData.categoryGroup || formData.customCategory || '',
        // Ensure image has a default if empty
        image: formData.image || 'https://picsum.photos/seed/food/400/300',
        // Ensure variants is always an array
        variants: formData.variants || [],
      };

      if (editingItem && editingItem.id) {
        const itemRef = doc(db, 'restaurants', restaurantId, 'menu', editingItem.id);
        await updateDoc(itemRef, itemPayload);
        toast.success("Menu item updated!", { id: toastId });
      } else {
        const menuRef = collection(db, 'restaurants', restaurantId, 'menu');
        await addDoc(menuRef, {
          ...itemPayload,
          votes: 0,
          rating: 0
        });
        toast.success("Item added successfully!", { id: toastId });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast.error("Failed to save item: " + error.message, { id: toastId });
    }
  };

  const categorizeItem = (name?: string): CategoryType => {
    if (!name) return 'Veg';
    const n = name.toLowerCase();
    // Veg categories
    if (n.includes('pizza') || n.includes('burger') || n.includes('paneer') || n.includes('veg') || n.includes('mushroom') || n.includes('salad') || n.includes('gobi') || n.includes('potato') || n.includes('aloo') || n.includes('dal') || n.includes('rice') || n.includes('roti') || n.includes('naan') || n.includes('pasta') || n.includes('sandwich')) return 'Veg';
    // Non-Veg categories
    if (n.includes('chicken') || n.includes('mutton') || n.includes('fish') || n.includes('egg') || n.includes('prawn') || n.includes('meat') || n.includes('beef') || n.includes('pork') || n.includes('kabab') || n.includes('tikka') || n.includes('biryani')) return 'Non-Veg'; // Keep for now, but allow custom categories
    // Drinks categories
    if (n.includes('tea') || n.includes('coffee') || n.includes('juice') || n.includes('soda') || n.includes('water') || n.includes('coke') || n.includes('pepsi') || n.includes('shake') || n.includes('lassi') || n.includes('beverage') || n.includes('drink') || n.includes('soup') || n.includes('mocktail')) return 'Drinks';
    // Dessert categories
    if (n.includes('ice cream') || n.includes('cake') || n.includes('pastry') || n.includes('sweet') || n.includes('gulab') || n.includes('halwa') || n.includes('pudding') || n.includes('brownie')) return 'Dessert';
    return 'Veg';
  };

  const [rawTextFallback, setRawTextFallback] = useState<string>('');
  const [isFallbackModalOpen, setIsFallbackModalOpen] = useState(false);
  const [manualText, setManualText] = useState<string>('');
  const [isManualInputModalOpen, setIsManualInputModalOpen] = useState(false);

  const extractItemsWithGemini = async (text: string, base64Image?: string): Promise<Partial<MenuItem>[]> => {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set.");
      toast.error("AI features require a configured GEMINI_API_KEY.");
      return [];
    }

    try {
      const parts: Record<string, unknown>[] = [];
      if (base64Image) {
        // Clean the Base64 string: Ensure the "data:image/..." prefix is stripped
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Data
          }
        });
      }
      parts.push({
        text: `Extract items from this menu image. 
      - Name: Full item name.
      - Variants: Map S/M/L or different prices to [{size: 'S', price: 100}, ...].
      - category: The EXACT header or section name from the image (e.g., 'The Best Special Range', 'The Best Premium Range', 'Momos', 'Breads'). Do NOT use generic names like "Pizza" unless it is the actual header.
      - description: Item description or ingredients.
      - Image: Return empty string ("").
      Return a flat JSON structure that matches: { name, price, category, description, variants: [{size, price}] }.
      Output ONLY a JSON array.
              
              Menu Text:
              ${text}`
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error("Gemini API Error:", errData);
        throw new Error(errData.error?.message || "Failed to generate content");
      }

      const data = await response.json();
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
      const parsedData = JSON.parse(jsonStr) as { name: string; price?: number; category?: string; description?: string; image?: string; variants?: { size: string; price: number }[] }[];
      const flatItems: Partial<MenuItem>[] = [];

      parsedData.forEach(item => {
        const itemName = item.name || 'Unknown Item';
        const exactCategory = item.category || '';
        flatItems.push({
          name: itemName,
          description: item.description || '',
          price: item.price || (item.variants && item.variants.length > 0 ? item.variants[0].price : 0),
          categoryGroup: exactCategory || categorizeItem(itemName),
          variants: item.variants || [],
          image: '',
          available: true,
        });
      });
      
      return flatItems;
    } catch (error) {
      console.error("Gemini Extraction Error:", error);
      toast.error("AI Extraction failed. Falling back to manual review.");
      return [];
    }
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not get canvas context'));
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const analyzeImage = async (file: File): Promise<Partial<MenuItem>[]> => {
    setIsExtracting(true);
    const toastId = toast.loading('Performing OCR and AI Extraction...');
    let base64Image: string | undefined;
    let fullText: string = '';

    try {
      // Resize image first
      base64Image = await resizeImage(file, 1024, 1024, 0.8); // Resize to max 1024px, 80% quality

      // Perform OCR
      const result = await Tesseract.recognize(file, 'eng');
      fullText = result.data.text;
      
      let items: Partial<MenuItem>[] = [];
      items = await extractItemsWithGemini(fullText, base64Image);

      if (items.length === 0) {
        setRawTextFallback(fullText);
        setIsFallbackModalOpen(true);
        toast.error('Could not auto-parse items. Showing raw text for manual review.', { id: toastId });
      } else {
        toast.success(`AI found ${items.length} items.`, { id: toastId });
      }
      return items;
    } catch (error) {
      console.error('OCR/AI Error:', error);
      toast.error('Failed to analyze image.', { id: toastId });
      return [];
    } finally {
      setIsExtracting(false);
    }
  };

  const handleManualTextSubmit = async () => {
    if (!manualText.trim()) {
      toast.error("Please enter some text.");
      return;
    }
    setIsManualInputModalOpen(false);
    setIsExtracting(true);
    const toastId = toast.loading('Processing manual text...');
    try {
      const items = await extractItemsWithGemini(manualText);
      if (items.length === 0) {
        toast.error('Could not auto-parse items from manual text. Please refine your input.', { id: toastId });
      } else {
        toast.success(`Found ${items.length} items from manual text.`, { id: toastId });
        setReviewItems(items);
        setIsReviewModalOpen(true);
      }
    } catch (error) {
      console.error('Manual Text Processing Error:', error);
      toast.error('Failed to process manual text.', { id: toastId });
    } finally {
      setIsExtracting(false);
      setManualText('');
    }
  };

  const analyzeExcel = async (file: File): Promise<Partial<MenuItem>[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as { Name?: string; name?: string; Price?: number; price?: number; Category?: string; category?: string; Description?: string; description?: string }[];
        
        const items = json.map(row => ({
          name: row.Name || row.name || '',
          price: parseFloat(String(row.Price || row.price || 0)),
          categoryGroup: row.Category || row.category || categorizeItem(row.Name || row.name || ''),
          description: row.Description || row.description || '',
          image: `https://loremflickr.com/400/300/${encodeURIComponent((row.Name || row.name || 'food').toLowerCase().replace(/ /g, '-'))},food`,
          available: true,
        }));
        resolve(items);
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadType) return;

    let extracted: Partial<MenuItem>[] = [];
    if (uploadType === 'image') extracted = await analyzeImage(file);
    if (uploadType === 'excel') extracted = await analyzeExcel(file);

    if (extracted.length > 0) {
      setReviewItems(extracted);
      setIsReviewModalOpen(true);
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadType(null);
  };

  const handleBulkAdd = async () => {
    if (!restaurantId) return;
    const toastId = toast.loading(`Adding ${reviewItems.length} items...`);
    try {
      const menuRef = collection(db, 'restaurants', restaurantId, 'menu');
      for (const item of reviewItems) {
        await addDoc(menuRef, {
          ...item,
          votes: 0,
          rating: 0
        });
      }
      toast.success(`Successfully added ${reviewItems.length} items!`, { id: toastId });
      setIsReviewModalOpen(false);
      setReviewItems([]);
    } catch (error) {
      console.error('Bulk Add Error:', error);
      toast.error('Failed to add some items.', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!restaurantId) return;
    try {
      await deleteDoc(doc(db, 'restaurants', restaurantId, 'menu', id));
      toast.success("Item deleted successfully");
      setSelectedItems(prev => prev.filter(itemId => itemId !== id));
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const handleBulkDelete = async () => {
    if (!restaurantId || selectedItems.length === 0) return;

    const toastId = toast.loading(`Deleting ${selectedItems.length} items...`);
    try {
      for (const id of selectedItems) {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'menu', id));
      }
      toast.success(`Successfully deleted ${selectedItems.length} items!`, { id: toastId });
      setSelectedItems([]);
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Failed to delete some items.", { id: toastId });
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const filteredAndGroupedItems = React.useMemo(() => {
    let currentItems = items;

    if (filterCategoryGroup !== 'All') {
      currentItems = currentItems.filter(item => item.categoryGroup === filterCategoryGroup);
    }

    const grouped = currentItems.reduce((acc, item) => {
      const groupName = item.categoryGroup || 'Uncategorized';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    return grouped;
  }, [items, filterCategoryGroup]);

  const uniqueCategoryGroups = React.useMemo(() => {
    const menuCategories = Array.from(new Set(items.map(item => item.categoryGroup).filter(Boolean) as string[]));
    
    if (!currentRestaurant?.categoryOrder) {
        return ['All', ...menuCategories.sort()];
    }

    const orderedGroups = currentRestaurant.categoryOrder.filter(group => 
        menuCategories.includes(group)
    );
    const remainingGroups = menuCategories.filter(group => !orderedGroups.includes(group)).sort();
    
    return ['All', ...orderedGroups, ...remainingGroups];
  }, [items, currentRestaurant?.categoryOrder]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading menu...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 flex items-center">
             Menu Management 
             <span className="ml-3 text-xs font-normal bg-orange-100 text-orange-800 px-2 py-1 rounded-full border border-orange-200">
               {currentRestaurant?.name}
             </span>
           </h2>
           <p className="text-gray-500 text-sm">Manage food items for {currentRestaurant?.name}.</p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-medium flex items-center transition shadow-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedItems.length})
            </button>
          )}
          <div className="relative" ref={importDropdownRef}>
            <button 
              onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium flex items-center transition shadow-sm"
              disabled={isExtracting}
            >
              {isExtracting ? (
                <div className="flex items-center text-orange-600">
                  <BrainCircuit className="h-4 w-4 mr-2 animate-pulse" />
                  <span className="text-sm font-medium">Gemini AI is analyzing...</span>
                </div>
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              <span>Import Menu</span>
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isImportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isImportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                <button 
                  onClick={() => { setUploadType('image'); fileInputRef.current?.click(); setIsImportDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center"
                >
                  <ImageLucide className="h-4 w-4 mr-2" /> Upload Image
                </button>
                <button 
                  onClick={() => { setUploadType('excel'); fileInputRef.current?.click(); setIsImportDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Upload Excel
                </button>
                <button 
                  onClick={() => { setIsManualInputModalOpen(true); setIsImportDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center"
                >
                  <BrainCircuit className="h-4 w-4 mr-2" /> Paste Menu Text
                </button>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept={uploadType === 'excel' ? ".xlsx, .xls, .csv" : "image/*"}
              onChange={handleFileUpload} 
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </button>
        </div>
      </div>

      {/* Category Group Filter Tabs */}
      <div className="flex flex-wrap p-1 bg-gray-100 rounded-lg gap-2 mb-6">
        {uniqueCategoryGroups.map((group) => (
          <button
            key={group}
            onClick={() => setFilterCategoryGroup(group)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filterCategoryGroup === group
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Menu List - Grouped by category */}
      <div className="space-y-8">
        {Object.entries(filteredAndGroupedItems).length === 0 ? (
          <div className="p-8 text-center text-gray-500">No menu items found for the selected filter.</div>
        ) : (
          <React.Fragment>
            {uniqueCategoryGroups.filter(cat => cat !== 'All' && filteredAndGroupedItems[cat]).map(categoryGroup => {
              const itemsInGroup = filteredAndGroupedItems[categoryGroup];
              return (
                <div key={categoryGroup}>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2 border-gray-200">{categoryGroup}</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                              checked={itemsInGroup.length > 0 && selectedItems.length === itemsInGroup.length}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {itemsInGroup.map((item) => (
                          <tr key={item.id} className={`hover:bg-gray-50 transition ${selectedItems.includes(item.id) ? 'bg-orange-50/30' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => toggleSelectItem(item.id)}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0">
                                  <img className="h-10 w-10 rounded-lg object-cover bg-gray-100" src={item.image} alt="" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {item.categoryGroup || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              ₹{item.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {item.available !== false ? (
                                <Badge variant="success">Available</Badge>
                              ) : (
                                <Badge variant="error">Out of Stock</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button onClick={() => handleOpenModal(item)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
          </React.Fragment>
        )}
      </div>

      {/* Manual Text Input Modal */}
      {isManualInputModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Paste Menu Text</h3>
              <button onClick={() => setIsManualInputModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm resize-y"
                placeholder="Paste your menu text here..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              ></textarea>
              <button
                onClick={handleManualTextSubmit}
                className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center transition shadow-sm"
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <div className="flex items-center text-white">
                    <BrainCircuit className="h-4 w-4 mr-2 animate-pulse" />
                    <span className="text-sm font-medium">Analyzing...</span>
                  </div>
                ) : (
                  <>Process Text</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Extracted Items Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Review Extracted Items</h3>
                <p className="text-sm text-gray-500">We found {reviewItems.length} items. Please verify before adding.</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setReviewItems([])}
                  className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition flex items-center"
                >
                  <Trash2 className="h-3 w-3 mr-1.5" /> Clear All
                </button>
                <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Item Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Price/Variants</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reviewItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <input 
                            type="text" 
                            className="w-full border-none bg-transparent focus:ring-0 text-sm font-medium text-gray-900"
                            value={item.name}
                            onChange={(e) => {
                              const newItems = [...reviewItems];
                              newItems[idx].name = e.target.value;
                              setReviewItems(newItems);
                            }}
                          />
                          <button 
                            onClick={() => {
                              const currentName = item.name || '';
                              const words = currentName.split(' ');
                              if (words.length > 1) {
                                const splitPoint = Math.ceil(words.length / 2);
                                const name1 = words.slice(0, splitPoint).join(' ');
                                const name2 = words.slice(splitPoint).join(' ');
                                
                                const newItems = [...reviewItems];
                                newItems[idx].name = name1;
                                newItems.splice(idx + 1, 0, {
                                  ...item,
                                  name: name2,
                                  price: 0,
                                  image: `https://loremflickr.com/400/300/${encodeURIComponent(name2)},food`
                                });
                                setReviewItems(newItems);
                              }
                            }}
                            className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center w-fit"
                          >
                            <Scissors className="h-2.5 w-2.5 mr-1" /> Split Item
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="text-gray-400 mr-1 text-sm">₹</span>
                            <input 
                              type="number" 
                              className="w-24 border border-gray-200 rounded-lg bg-white px-2 py-1 focus:ring-1 focus:ring-orange-500 text-sm text-gray-700 font-bold"
                              value={isNaN(item.price as number) ? 0 : item.price}
                              onChange={(e) => {
                                const newItems = [...reviewItems];
                                newItems[idx].price = parseFloat(e.target.value) || 0;
                                setReviewItems(newItems);
                              }}
                            />
                          </div>
                          {item.variants && item.variants.length > 0 && (
                            <div className="text-[10px] text-gray-500">
                              {item.variants.map((v, vIdx) => (
                                <div key={vIdx}>{v.size}: ₹{v.price}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <input 
                            type="text"
                            list="custom-categories-list"
                            placeholder="Select or type category"
                            className="border border-gray-200 rounded-lg bg-white px-2 py-1 focus:ring-1 focus:ring-orange-500 text-sm text-gray-700"
                            value={item.categoryGroup}
                            onChange={(e) => {
                              const newItems = [...reviewItems];
                              newItems[idx].categoryGroup = e.target.value;
                              setReviewItems(newItems);
                            }}
                          />
                          <datalist id="custom-categories-list">
                            {currentRestaurant?.customCategories?.map(cat => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          className="w-full border-none bg-transparent focus:ring-0 text-sm text-gray-600"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...reviewItems];
                            newItems[idx].description = e.target.value;
                            setReviewItems(newItems);
                          }}
                          placeholder="Description..."
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => setReviewItems(reviewItems.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {reviewItems.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No items to review. Try uploading again.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="font-bold text-gray-900">{reviewItems.length}</span> items ready to be added.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setReviewItems([])}
                  className="px-6 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition"
                >
                  Clear All
                </button>
                <button 
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-white transition"
                >
                  Discard
                </button>
                <button 
                  onClick={handleBulkAdd}
                  disabled={reviewItems.length === 0}
                  className="px-8 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 shadow-lg shadow-orange-200 disabled:opacity-50 disabled:shadow-none transition flex items-center"
                >
                  <Check className="h-4 w-4 mr-2" /> Confirm & Add All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isFallbackModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Manual Text Review</h3>
              <button onClick={() => setIsFallbackModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">We could not automatically detect items. You can edit the raw text below and try to re-parse it.</p>
              <textarea 
                className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                value={rawTextFallback}
                onChange={(e) => setRawTextFallback(e.target.value)}
                placeholder="Paste menu text here..."
              />
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsFallbackModalOpen(false)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const items = await extractItemsWithGemini(rawTextFallback);
                  if (items.length > 0) {
                    setReviewItems(items);
                    setIsReviewModalOpen(true);
                    setIsFallbackModalOpen(false);
                  } else {
                    toast.error("Still couldn't extract items. Please refine text or try again.");
                  }
                }}
                className="px-8 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 shadow-lg"
              >
                <BrainCircuit className="h-4 w-4 mr-2" /> Re-analyze Text
              </button>

            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in my-8">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">
                        {editingItem ? 'Edit Item' : 'Add New Item'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type (Category)</label>
                                <input 
                                    type="text"
                                    list="form-categories-list"
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.categoryGroup}
                                    onChange={(e) => setFormData({...formData, categoryGroup: e.target.value})}
                                    placeholder="Select or type category"
                                />
                                <datalist id="form-categories-list">
                                    {currentRestaurant?.customCategories?.map(cat => (
                                      <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={isNaN(formData.price as number) ? 0 : formData.price}
                                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Manage Categories</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.categoryGroup}
                                    onChange={(e) => setFormData({...formData, categoryGroup: e.target.value})}
                                    placeholder="Enter new category name..."
                                />
                                <button 
                                    type="button"
                                    onClick={handleAddCategory}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shadow-sm"
                                >
                                    Add
                                </button>
                            </div>
                            {currentRestaurant?.customCategories && currentRestaurant.customCategories.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {currentRestaurant.customCategories.map(cat => (
                                  <div key={cat} className="flex items-center bg-gray-100 px-2 py-1 rounded-md text-xs text-gray-700">
                                    {cat}
                                    <button 
                                      type="button"
                                      onClick={async () => {
                                        if (!currentRestaurant?.id) return;
                                        const newCats = currentRestaurant.customCategories?.filter(c => c !== cat) || [];
                                        await updateDoc(doc(db, 'restaurants', currentRestaurant.id), {
                                          customCategories: newCats
                                        });
                                        toast.success(`Category "${cat}" removed`);
                                      }}
                                      className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">Price Variants (Optional)</label>
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, variants: [...(formData.variants || []), {size: '', price: 0}]})}
                                    className="text-xs text-orange-600 font-bold flex items-center"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Variant
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.variants?.map((variant, vIdx) => (
                                    <div key={vIdx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Size (S, M, L)"
                                            className="flex-1 rounded-lg border-gray-300 border px-3 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                                            value={variant.size}
                                            onChange={(e) => {
                                                const newVariants = [...(formData.variants || [])];
                                                newVariants[vIdx].size = e.target.value;
                                                setFormData({...formData, variants: newVariants});
                                            }}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Price"
                                            className="w-24 rounded-lg border-gray-300 border px-3 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                                            value={isNaN(variant.price as number) ? 0 : variant.price}
                                            onChange={(e) => {
                                                const newVariants = [...(formData.variants || [])];
                                                newVariants[vIdx].price = parseFloat(e.target.value) || 0;
                                                setFormData({...formData, variants: newVariants});
                                            }}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setFormData({...formData, variants: formData.variants?.filter((_, i) => i !== vIdx)})}
                                            className="text-red-500 p-1"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <ImageIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        value={formData.image}
                                        onChange={(e) => setFormData({...formData, image: e.target.value})}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea 
                                rows={3}
                                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            />
                        </div>

                        <div className="flex items-center">
                            <input 
                                id="available"
                                type="checkbox"
                                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                checked={formData.available !== false}
                                onChange={(e) => setFormData({...formData, available: e.target.checked})}
                            />
                            <label htmlFor="available" className="ml-2 block text-sm text-gray-900">
                                Available for order
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2 bg-orange-600 rounded-lg text-sm font-medium text-white hover:bg-orange-700 shadow-sm"
                        >
                            {editingItem ? 'Update Item' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default MenuManager;
