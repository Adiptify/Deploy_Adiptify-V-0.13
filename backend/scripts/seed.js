import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import Item from "../models/Item.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";

async function seed() {
    await mongoose.connect(MONGO_URI, { dbName: process.env.MONGO_DB || "adiptify" });
    console.log("Connected to MongoDB for seeding...");

    // Create demo users
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
        { name: "Admin User", email: "admin@adiptify.com", passwordHash, role: "admin" },
        { name: "Instructor Demo", email: "instructor@adiptify.com", passwordHash, role: "instructor" },
        { name: "Student Demo", email: "student@adiptify.com", passwordHash, role: "student", studentId: "STU001" },
        {
            name: "Alice Johnson", email: "alice@adiptify.com", passwordHash, role: "student", studentId: "STU002",
            learnerProfile: { topics: { "Algebra": { mastery: 72, attempts: 15, streak: 3, timeOnTask: 45000 }, "Geometry": { mastery: 55, attempts: 8, streak: 0, timeOnTask: 22000 } } }
        },
        {
            name: "Bob Smith", email: "bob@adiptify.com", passwordHash, role: "student", studentId: "STU003",
            learnerProfile: { topics: { "Calculus": { mastery: 88, attempts: 20, streak: 5, timeOnTask: 60000 }, "Statistics": { mastery: 40, attempts: 6, streak: 1, timeOnTask: 15000 } } }
        },
    ];

    for (const u of users) {
        await User.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true });
    }
    console.log(`✅ ${users.length} users seeded`);

    // Create sample items
    const sampleItems = [
        { type: "mcq", question: "What is 2 + 2?", choices: ["3", "4", "5", "6"], answer: 1, difficulty: 1, bloom: "remember", topics: ["Arithmetic"], explanation: "Basic addition: 2 + 2 = 4", hints: ["Count on your fingers"] },
        { type: "mcq", question: "Solve for x: 2x + 3 = 7", choices: ["x = 1", "x = 2", "x = 3", "x = 4"], answer: 1, difficulty: 2, bloom: "apply", topics: ["Algebra"], explanation: "2x = 4, so x = 2" },
        { type: "mcq", question: "What is the derivative of x²?", choices: ["x", "2x", "x²", "2"], answer: 1, difficulty: 3, bloom: "understand", topics: ["Calculus"], explanation: "Using the power rule: d/dx(x²) = 2x" },
        { type: "mcq", question: "What is the area of a circle with radius 5?", choices: ["25π", "10π", "5π", "50π"], answer: 0, difficulty: 2, bloom: "apply", topics: ["Geometry"], explanation: "A = πr² = π(5)² = 25π" },
        { type: "mcq", question: "What is the mean of {2, 4, 6, 8, 10}?", choices: ["4", "5", "6", "7"], answer: 2, difficulty: 1, bloom: "remember", topics: ["Statistics"], explanation: "Mean = (2+4+6+8+10)/5 = 30/5 = 6" },
        { type: "mcq", question: "What is P(heads) for a fair coin?", choices: ["0.25", "0.5", "0.75", "1"], answer: 1, difficulty: 1, bloom: "remember", topics: ["Probability"], explanation: "A fair coin has equal probability for heads and tails = 0.5" },
        { type: "mcq", question: "Factorize: x² - 9", choices: ["(x-3)(x+3)", "(x-9)(x+1)", "(x-3)²", "(x+3)²"], answer: 0, difficulty: 3, bloom: "apply", topics: ["Algebra"], explanation: "Difference of squares: a² - b² = (a-b)(a+b)" },
        { type: "mcq", question: "What is the integral of 2x?", choices: ["x", "x²", "x² + C", "2x² + C"], answer: 2, difficulty: 3, bloom: "apply", topics: ["Calculus"], explanation: "∫2x dx = x² + C" },
        { type: "mcq", question: "The Pythagorean theorem states:", choices: ["a+b=c", "a²+b²=c²", "a×b=c", "a/b=c"], answer: 1, difficulty: 2, bloom: "remember", topics: ["Geometry"], explanation: "For a right triangle, the sum of squares of the two shorter sides equals the square of the hypotenuse." },
        { type: "mcq", question: "Standard deviation measures:", choices: ["Central tendency", "Spread of data", "Skewness", "Correlation"], answer: 1, difficulty: 2, bloom: "understand", topics: ["Statistics"], explanation: "Standard deviation quantifies the amount of variation or dispersion in a dataset." },
    ];

    await Item.deleteMany({});
    await Item.insertMany(sampleItems);
    console.log(`✅ ${sampleItems.length} sample items seeded`);

    await mongoose.disconnect();
    console.log("✅ Seeding complete!");
}

seed().catch(console.error);
