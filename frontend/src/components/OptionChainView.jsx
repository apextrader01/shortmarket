import React from 'react';
import { Clock } from 'lucide-react';

export default function OptionChainView() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4 bg-[#0b0e14]">
      <div className="bg-[#111620] p-8 rounded-2xl border border-slate-800 shadow-xl max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-500/10 rounded-full">
            <Clock className="w-12 h-12 text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Options Trading</h2>
        <p className="text-slate-400 text-lg mb-6">
          This feature is currently under development and will be coming soon.
        </p>
        <div className="text-sm text-slate-500">
          We're working hard to bring you a seamless options trading experience.
        </div>
      </div>
    </div>
  );
}
