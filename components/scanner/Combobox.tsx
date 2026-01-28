import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowFreeInput?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = '選択または入力...',
  className = '',
  disabled = false,
  allowFreeInput = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search text
  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lowerSearch = searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lowerSearch));
  }, [options, searchText]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchText('');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightIndex]);
        } else if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0]);
        } else if (allowFreeInput && searchText) {
          handleSelect(searchText);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchText : value}
          onChange={e => {
            setSearchText(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
            if (allowFreeInput) {
              onChange(e.target.value);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                onClick={() => handleSelect(option)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  index === highlightIndex
                    ? 'bg-orange-100 text-orange-700'
                    : 'hover:bg-slate-50'
                }`}
              >
                {option}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">
              {allowFreeInput ? '入力してください' : '該当する項目がありません'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
