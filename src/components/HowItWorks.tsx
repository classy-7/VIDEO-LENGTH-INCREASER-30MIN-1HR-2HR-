import React from 'react';
import { UploadCloud, Sliders, Sparkles } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Upload Video',
      description: 'Upload your short video clip in MP4, MOV, WebM, or MKV format.',
      icon: UploadCloud,
      gradient: 'from-cyan-500/20 to-cyan-500/5',
      border: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      num: '02',
      title: 'Choose Duration',
      description: 'Select 30 Minutes, 1 Hour, 2 Hours, or customize your exact target length.',
      icon: Sliders,
      gradient: 'from-indigo-500/20 to-indigo-500/5',
      border: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
    },
    {
      num: '03',
      title: 'Generate & Download',
      description: 'Our FFmpeg engine seamlessly loops the video and trims the final repetition to exact millisecond precision.',
      icon: Sparkles,
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className="w-full py-8">
      <div className="text-center mb-8">
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase">
          How It Works
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Three simple steps to extend any short video to your desired length
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className={`p-6 rounded-2xl bg-gradient-to-b ${step.gradient} border ${step.border} backdrop-blur-md relative flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-black tracking-widest text-zinc-500 uppercase">
                    Step {step.num}
                  </span>
                  <div className={`p-2 rounded-xl bg-zinc-950/80 ${step.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
