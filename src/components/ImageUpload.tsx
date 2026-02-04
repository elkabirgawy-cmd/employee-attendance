import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  employeeName: string;
  employeeId: string;
  onUploadComplete: (url: string) => void;
  language?: string;
}

export default function ImageUpload({
  currentImageUrl,
  employeeName,
  employeeId,
  onUploadComplete,
  language = 'ar',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(language === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 10MB)' : 'Image too large (max 10MB)');
      return;
    }

    try {
      setUploading(true);

      const compressedBlob = await compressImage(file);

      if (compressedBlob.size > 300 * 1024) {
        console.warn('Image still larger than 300KB after compression:', compressedBlob.size);
      }

      const previewUrl = URL.createObjectURL(compressedBlob);
      setPreviewUrl(previewUrl);

      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      if (currentImageUrl) {
        const oldPath = currentImageUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('employee-avatars').remove([oldPath]);
        }
      }

      const { error: uploadError, data } = await supabase.storage
        .from('employee-avatars')
        .upload(filePath, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('employee-avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('employees')
        .update({ avatar_url: publicUrl })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      onUploadComplete(publicUrl);
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || (language === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentImageUrl) return;

    try {
      setUploading(true);

      const oldPath = currentImageUrl.split('/').pop();
      if (oldPath) {
        await supabase.storage.from('employee-avatars').remove([oldPath]);
      }

      const { error: updateError } = await supabase
        .from('employees')
        .update({ avatar_url: null })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      setPreviewUrl(null);
      onUploadComplete('');
    } catch (err: any) {
      console.error('Error removing image:', err);
      setError(err.message || (language === 'ar' ? 'فشل حذف الصورة' : 'Failed to remove image'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar src={previewUrl} name={employeeName} size="xl" />
          {previewUrl && !uploading && (
            <button
              onClick={handleRemove}
              className="absolute top-0 right-0 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition"
              type="button"
            >
              <X size={16} />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <Loader className="animate-spin text-white" size={32} />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Upload size={16} />
            {language === 'ar' ? 'اختيار صورة' : 'Choose Image'}
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute('capture', 'environment');
                fileInputRef.current.click();
              }
            }}
            disabled={uploading}
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Camera size={16} />
            {language === 'ar' ? 'التقاط صورة' : 'Take Photo'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <p className="text-xs text-slate-500 text-center">
        {language === 'ar'
          ? 'الحد الأقصى للحجم: 10MB • سيتم ضغط الصورة تلقائياً'
          : 'Max size: 10MB • Image will be compressed automatically'}
      </p>
    </div>
  );
}
