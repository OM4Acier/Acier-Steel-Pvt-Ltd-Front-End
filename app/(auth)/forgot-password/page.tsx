"use client"
import React from 'react';
import { Ban } from 'lucide-react'; // Import the Ban icon from lucide-react

const UnavailableFeaturePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 font-sans">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-md w-full">
        {/* Icon for the unavailable feature, now using lucide-react */}
        <div className="mb-6">
          <Ban className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Main heading */}
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          Feature Unavailable
        </h1>

        {/* Descriptive text */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We&rsquo;re working hard to bring you this exciting feature! Please check back soon for updates.
        </p>

        {/* Optional: A call to action, e.g., go back home */}
        <button
          onClick={() => window.history.back()} // Simple back button functionality
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default UnavailableFeaturePage;