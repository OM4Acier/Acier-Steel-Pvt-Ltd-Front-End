import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const handleDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-gray-800');
};

export const handleDragLeave = (event: React.DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-800');
};

export const handleDrop = (
  event: React.DragEvent,
  callback: (files: File[]) => void
) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-800');
  
  const files = Array.from(event.dataTransfer.files);
  callback(files);
};
