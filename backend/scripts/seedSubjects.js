/**
 * Seed default subjects into MongoDB.
 * Run: node scripts/seedSubjects.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Subject from "../models/Subject.js";

dotenv.config();

const DEFAULT_SUBJECTS = [
    {
        name: "Machine Learning",
        slug: "machine-learning",
        description: "Fundamentals of supervised and unsupervised learning, regression, classification, and clustering algorithms.",
        icon: "🤖",
        color: "emerald",
        topics: ["linear_regression", "logistic_regression", "gradient_descent", "decision_trees", "clustering_kmeans", "random_forests"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Deep Learning",
        slug: "deep-learning",
        description: "Neural networks, CNNs, RNNs, transformers, and modern architectures for AI.",
        icon: "🧠",
        color: "purple",
        topics: ["neural_networks_basics", "cnn", "rnn", "transformers", "backpropagation"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Natural Language Processing",
        slug: "natural-language-processing",
        description: "Text processing, tokenization, sentiment analysis, and language models.",
        icon: "💬",
        color: "sky",
        topics: ["nlp_tokenization", "sentiment_analysis", "word_embeddings", "text_classification"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Data Analytics",
        slug: "data-analytics",
        description: "Data preprocessing, EDA, visualization, and statistical analysis.",
        icon: "📊",
        color: "amber",
        topics: ["data_preprocessing", "eda", "data_visualization", "statistical_testing"],
        category: "Data Science",
        isDefault: true,
    },
    {
        name: "Web Development",
        slug: "web-development",
        description: "HTML, CSS, JavaScript, React, and modern web frameworks.",
        icon: "🌐",
        color: "blue",
        topics: ["html_css", "javascript_fundamentals", "react_basics", "web_apis", "http_protocols"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Python Programming",
        slug: "python-programming",
        description: "Python syntax, data structures, OOP, and standard library.",
        icon: "🐍",
        color: "yellow",
        topics: ["python_basics", "python_oop", "python_data_structures", "python_stdlib"],
        category: "Programming",
        isDefault: true,
    },
    {
        name: "Data Structures & Algorithms",
        slug: "data-structures-algorithms",
        description: "Arrays, trees, graphs, sorting, searching, and time complexity.",
        icon: "🏗️",
        color: "indigo",
        topics: ["arrays_strings", "linked_lists", "trees_graphs", "sorting_algorithms", "dynamic_programming", "time_complexity"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Advanced Calculus",
        slug: "advanced-calculus",
        description: "Limits, derivatives, integrals, series, and multivariable calculus.",
        icon: "📐",
        color: "rose",
        topics: ["limits_continuity", "derivatives", "integrals", "series", "multivariable_calculus"],
        category: "Mathematics",
        isDefault: false,
    },
    {
        name: "Quantum Mechanics",
        slug: "quantum-mechanics",
        description: "Wave functions, Schrödinger equation, quantum states, and measurement.",
        icon: "⚛️",
        color: "teal",
        topics: ["wave_particle_duality", "schrodinger_equation", "quantum_states", "quantum_measurement"],
        category: "Physics",
        isDefault: false,
    },
];

async function seed() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";
    const MONGO_DB = process.env.MONGO_DB || "adiptify";

    try {
        await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
        console.log("✅ Connected to MongoDB");

        for (const subject of DEFAULT_SUBJECTS) {
            const exists = await Subject.findOne({ slug: subject.slug });
            if (exists) {
                console.log(`⏭️  "${subject.name}" already exists — skipping`);
            } else {
                await Subject.create(subject);
                console.log(`✅ Created "${subject.name}"`);
            }
        }

        console.log(`\n🎉 Seed complete — ${DEFAULT_SUBJECTS.length} subjects processed`);
    } catch (e) {
        console.error("❌ Seed failed:", e.message);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
