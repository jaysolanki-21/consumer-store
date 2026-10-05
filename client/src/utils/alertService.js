import Swal from 'sweetalert2';

/**
 * Standard SweetAlert2 configuration & helper service
 * Provides consistent styling, themes, and behavior across the entire application.
 */

const baseSwal = Swal.mixin({
  customClass: {
    popup: 'rounded-2xl dark:bg-slate-800 dark:text-white border dark:border-slate-700 shadow-2xl',
    title: 'text-slate-800 dark:text-white font-bold',
    htmlContainer: 'text-slate-600 dark:text-slate-300 text-sm',
    confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-white transition focus:outline-none shadow-md',
    cancelButton: 'px-5 py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition focus:outline-none mr-2'
  },
  buttonsStyling: true
});

/**
 * Show a success alert
 */
export const showSuccess = (title, message = '', timer = 2000) => {
  return baseSwal.fire({
    icon: 'success',
    title,
    text: message,
    timer: timer || undefined,
    showConfirmButton: !timer,
    confirmButtonColor: '#10b981' // emerald-500
  });
};

/**
 * Show an error alert
 */
export const showError = (title, message = 'Something went wrong. Please try again.') => {
  return baseSwal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#ef4444' // red-500
  });
};

/**
 * Show a warning alert
 */
export const showWarning = (title, message = '') => {
  return baseSwal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#f59e0b' // amber-500
  });
};

/**
 * Show an information alert
 */
export const showInfo = (title, message = '') => {
  return baseSwal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#6366f1' // indigo-500
  });
};

/**
 * Show a confirmation dialog
 * Returns Promise<boolean> (true if confirmed, false otherwise)
 */
export const showConfirm = async ({
  title = 'Are you sure?',
  text = 'This action cannot be undone.',
  confirmButtonText = 'Yes, Proceed',
  cancelButtonText = 'Cancel',
  confirmButtonColor = '#ef4444',
  icon = 'warning'
} = {}) => {
  const result = await baseSwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor,
    cancelButtonColor: '#94a3b8',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true
  });

  return result.isConfirmed;
};

/**
 * Quick toast notification using SweetAlert
 */
export const swalToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export default baseSwal;
