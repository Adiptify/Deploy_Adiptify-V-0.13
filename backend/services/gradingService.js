/**
 * Grade a student's answer against the correct answer
 * Supports MCQ (index comparison) and text-based answers
 */
export function gradeAnswer(item, userAnswer) {
    const type = item.type || "mcq";

    if (type === "mcq") {
        // MCQ: compare index
        const correctIdx = typeof item.answer === "number" ? item.answer : parseInt(item.answer);
        const userIdx = typeof userAnswer === "number" ? userAnswer : parseInt(userAnswer);
        const isCorrect = correctIdx === userIdx;
        return {
            isCorrect,
            score: isCorrect ? 1 : 0,
            feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer was: ${item.choices?.[correctIdx] || item.answer}`,
        };
    }

    if (type === "fill_blank" || type === "short_answer") {
        // Text comparison: case-insensitive, trimmed
        const correct = String(item.answer).trim().toLowerCase();
        const user = String(userAnswer).trim().toLowerCase();
        const isCorrect = correct === user;
        return {
            isCorrect,
            score: isCorrect ? 1 : 0,
            feedback: isCorrect ? "Correct!" : `Incorrect. Expected: ${item.answer}`,
        };
    }

    // Default: exact match
    const isCorrect = JSON.stringify(item.answer) === JSON.stringify(userAnswer);
    return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        feedback: isCorrect ? "Correct!" : "Incorrect.",
    };
}

export default { gradeAnswer };
