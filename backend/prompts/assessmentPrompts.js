export const ASSESSMENT_GRADING_SYSTEM = `You are a strict assessment grading engine.
Given a question, correct answer, and student answer, determine if the student answer is correct.
For MCQ: compare index or text exactly.
For short answer: allow minor typos but require semantic correctness.
Output ONLY valid JSON:
{
  "isCorrect": true|false,
  "score": 0.0-1.0,
  "feedback": ""
}`;

export function assessmentGradingUser(question, correctAnswer, studentAnswer, questionType) {
    return `Grade this ${questionType} question:
Question: "${question}"
Correct Answer: ${JSON.stringify(correctAnswer)}
Student Answer: ${JSON.stringify(studentAnswer)}`;
}
