import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SearchableSelect } from './SearchableSelect';
import { Loader2 } from 'lucide-react';

interface DynamicSelectProps {
  options?: string[];
  sourceTable?: string;
  sourceValue?: string;
  sourceLabel?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

import { useQuery } from '@tanstack/react-query';

export const DynamicSelect: React.FC<DynamicSelectProps> = ({
  options = [],
  sourceTable,
  sourceValue = 'name',
  sourceLabel = 'name',
  value,
  onChange,
  placeholder,
  className,
  disabled
}) => {
  const { 
    data: dynamicOptions, 
    isLoading: loading,
    isError,
    error
  } = useQuery({
    queryKey: ['select_options', sourceTable, sourceValue, sourceLabel],
    queryFn: async () => {
      if (!sourceTable) return options;
      
      try {
        console.log(`Fetching options from ${sourceTable}...`);
        
        // Ensure we always select at least one field and handle duplicates
        const selectFields = Array.from(new Set([sourceValue, sourceLabel])).join(', ');

        const { data, error: supabaseError } = await supabase
          .from(sourceTable)
          .select(selectFields)
          .order(sourceLabel, { ascending: true });

        if (supabaseError) {
          console.error(`Supabase error fetching from ${sourceTable}:`, supabaseError);
          throw supabaseError;
        }

        if (data && data.length > 0) {
          const mapped = data.map(item => String(item[sourceLabel as keyof typeof item] || ''));
          return mapped;
        }
        
        return options; // Fallback to provided options if no data
      } catch (err) {
        console.error(`Failed to fetch options for ${sourceTable}:`, err);
        throw err;
      }
    },
    enabled: !!sourceTable,
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const finalOptions = dynamicOptions || options;

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-11 px-3 border border-slate-200 rounded-md bg-slate-50 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm italic">Đang tải...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 h-11 px-3 border border-rose-200 rounded-md bg-rose-50 text-rose-500">
        <span className="text-sm italic">Lỗi tải dữ liệu</span>
        <button 
          type="button" 
          onClick={() => window.location.reload()}
          className="ml-auto text-[10px] underline"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <SearchableSelect 
      options={finalOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};
