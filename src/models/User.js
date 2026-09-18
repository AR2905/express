import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('User', userSchema);