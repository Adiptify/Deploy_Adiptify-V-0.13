import mongoose from "mongoose";

const experimentResultSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        experimentId: { type: String, required: true },
        experimentType: {
            type: String,
            enum: ["gradient_descent", "neural_network", "classification"],
            required: true,
        },
        parameters_used: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
        result_metrics: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

experimentResultSchema.index({ userId: 1, experimentType: 1 });

export const ExperimentResult = mongoose.model("ExperimentResult", experimentResultSchema);
export default ExperimentResult;
