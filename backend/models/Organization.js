/**
 * Organization Model — Multi-tenant org support.
 */
import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    domain: { type: String, default: '' },
    
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    settings: {
        allowSelfJoin: { type: Boolean, default: false },
        defaultLearningMode: { type: String, default: 'balanced' },
        maxMembers: { type: Number, default: 100 },
    },

    status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active' },
}, { timestamps: true });

// Auto-generate slug from name
organizationSchema.pre('validate', function () {
    if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
});

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ owner: 1 });
organizationSchema.index({ members: 1 });

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
