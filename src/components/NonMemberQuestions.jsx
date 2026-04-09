import { useState } from "react";
import { GUEST_QUESTION_BANK } from "../utils/constants";

export default function NonMemberQuestions({ onBack, onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const totalSteps = GUEST_QUESTION_BANK.length;
  const question = GUEST_QUESTION_BANK[step] || null;
  const progress = totalSteps > 0 ? `${Math.min(step + 1, totalSteps)}/${totalSteps}` : "0/0";
  const selectedValue = question ? answers[question.id] || "" : "";

  function updateAnswer(value) {
    if (!question) {
      return;
    }

    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  function handleNext() {
    if (!question) {
      onComplete(answers);
      return;
    }

    if (!String(selectedValue).trim()) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [question.id]: selectedValue,
    };

    if (step >= totalSteps - 1) {
      onComplete(nextAnswers);
      return;
    }

    setAnswers(nextAnswers);
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  function handleBack() {
    if (step === 0) {
      onBack();
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  if (!question) {
    return null;
  }

  return (
    <section className="brief-shell">
      <div className="brief-header">
        <span className="eyebrow">Guest brief</span>
        <span className="progress-pill">{progress}</span>
      </div>

      <div className="brief-copy">
        <h2>{question.title}</h2>
        <p>{question.subtitle}</p>
      </div>

      <div className="choice-grid">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`choice-tile ${selectedValue === option ? "is-selected" : ""}`}
            onClick={() => updateAnswer(option)}
          >
            <span>{option}</span>
          </button>
        ))}
      </div>

      <div className="brief-actions">
        <button type="button" className="ghost-button" onClick={handleBack}>
          Back
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleNext}
          disabled={!String(selectedValue).trim()}
        >
          {step >= totalSteps - 1 ? "Finish brief" : "Next"}
        </button>
      </div>
    </section>
  );
}
