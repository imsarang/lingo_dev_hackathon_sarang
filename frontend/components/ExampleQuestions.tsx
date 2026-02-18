'use client';

interface ExampleQuestionsProps {
  onQuestionClick: (question: string) => void;
}

const EXAMPLE_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the recommendations mentioned?",
  "Compare the different approaches discussed",
];

export default function ExampleQuestions({ onQuestionClick }: ExampleQuestionsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
        Try asking:
      </p>
      <div className="grid grid-cols-1 gap-2">
        {EXAMPLE_QUESTIONS.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="text-left p-3 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-zinc-700 dark:text-zinc-300"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
