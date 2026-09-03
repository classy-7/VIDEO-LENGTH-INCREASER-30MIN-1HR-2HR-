import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'How does Video-Length Increaser work?',
    answer:
      'It repeats your uploaded video until it reaches the selected target duration. The processing engine calculates the exact number of loops required, seamlessly concatenates the stream, and trims the final repetition so that the file matches the target length down to the millisecond.',
  },
  {
    question: 'Can I turn an 8-second video into a 1-hour video?',
    answer:
      'Yes. The system automatically repeats the 8-second video as many times as necessary (e.g. 450 loops) and trims the final repetition to create the exact target duration of 01:00:00.',
  },
  {
    question: 'Does it stretch my video?',
    answer:
      'No. The application repeats the original video rather than slowing or stretching it. Your video playback speed, frame rate, and visual quality remain 100% natural and identical to the original.',
  },
  {
    question: 'Is the final video exactly the selected duration?',
    answer:
      'Yes. Before making the file available for download, our backend automatically verifies the resulting media stream with FFprobe to guarantee that the duration matches your target with zero discrepancy.',
  },
  {
    question: 'Is the original audio repeated?',
    answer:
      'Yes. If the source contains audio, the audio track is looped seamlessly together with the video stream and cuts off cleanly when the target duration ends.',
  },
  {
    question: 'What happens if my video doesn\'t have audio?',
    answer:
      'The output remains silent. We do not generate artificial audio tracks if none exist in the source.',
  },
];

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Frequently Asked Questions</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Got Questions? We Have Answers.
        </h3>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-white text-sm sm:text-base hover:text-cyan-300 transition"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/50 pt-3 animate-in fade-in duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
