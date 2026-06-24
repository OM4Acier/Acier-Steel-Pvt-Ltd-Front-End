// lib/hooks/useNotify.ts
import toast from 'react-hot-toast';



export const useNotify = () => {
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    info: (msg: string) => toast(msg),
    loading: (msg: string) => toast.loading(msg),
    dismiss: () => toast.dismiss(),
  };
};




