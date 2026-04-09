import { useMemo, useState } from "react";
import { NON_MEMBER_QUESTIONS } from "../utils/constants";

export default function NonMemberQuestions({ onBack, onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const question = NON_MEMBER_QUESTIONS[step];
  const progress = useMemo(() => `${step + 1}/${NON_MEMBER_QUESTIONS.length}`, [step]);
  const selectedValue = answers[question.id];

  function handleOptionClick(option) {
    setAnswers((current) => ({ ...current, [question.id]: option }));
  }

  function handleNext() {
    if (!selectedValue) {
      return;
    }

    if (step === NON_MEMBER_QUESTIONS.length - 1) {
      onComplete(answers);
      return;
    }

    setStep((current) => current + 1);
  }

  function handleBack() {
    if (step === 0) {
      onBack();
      return;
    }

    setStep((current) => current - 1);
  }

  return (
    <section className="panel questions-panel">
      <div className="question-progress">
        <span className="eyebrow">Guest Discovery</span>
        <span className="progress-pill">{progress}</span>
      </div>

      <div className="panel-copy">
        <h2>{question.title}</h2>
        <p>{question.subtitle}</p>
      </div>

      <div className="option-grid">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`option-card ${selectedValue === option ? "is-selected" : ""}`}
            onClick={() => handleOptionClick(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={handleBack}>
          Back
        </button>
        <button type="button" className="primary-button" disabled={!selectedValue} onClick={handleNext}>
          {step === NON_MEMBER_QUESTIONS.length - 1 ? "See My Picks" : "Next"}
        </button>
      </div>
    </section>
  );
}
