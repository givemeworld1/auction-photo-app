import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

// --- MongoDB Schema & Model Initialization ---
const photoSchema = new mongoose.Schema(
  {
    lotNumber: { type: String, required: true, index: true },
    dateStr: { type: String, required: true, index: true },
    cloudinaryUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Prevent re-compiling model during Next.js Hot Module Replacement (HMR)
const Photo = mongoose.models.Photo || mongoose.model('Photo', photoSchema);

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Please define the MONGODB_URI environment variable in .env.local');
  }
  return mongoose.connect(mongoUri);
}

// --- POST Handler: Save Uploaded Photo Record ---
export async function POST(req) {
  try {
    const body = await req.json();
    const { lotNumber, dateStr, cloudinaryUrl, publicId } = body;

    // Validation
    if (!cloudinaryUrl || !publicId) {
      return NextResponse.json(
        { error: 'Missing required image parameters (cloudinaryUrl or publicId)' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fallback date to today's date (YYYY-MM-DD) if dateStr isn't supplied
    const formattedDate = dateStr || new Date().toISOString().split('T')[0];
    const formattedLot = lotNumber ? lotNumber.trim().toUpperCase() : 'UNNAMED-LOT';

    const newPhoto = await Photo.create({
      lotNumber: formattedLot,
      dateStr: formattedDate,
      cloudinaryUrl,
      publicId,
      createdAt: new Date()
    });

    return NextResponse.json({ success: true, photo: newPhoto }, { status: 201 });
  } catch (error) {
    console.error('API Photo Upload Handler Error:', error);
    return NextResponse.json(
      { error: 'Failed to save photo record to database', details: error.message },
      { status: 500 }
    );
  }
}

// --- GET Handler: Fetch All Photos for Gallery Directory ---
export async function GET() {
  try {
    await connectToDatabase();

    const photos = await Photo.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json(photos, { status: 200 });
  } catch (error) {
    console.error('API Photo Fetch Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve photos', details: error.message },
      { status: 500 }
    );
  }
}

// --- DELETE Handler: Remove Photo from DB ---
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('id');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    await connectToDatabase();
    await Photo.findByIdAndDelete(photoId);

    return NextResponse.json({ success: true, deletedId: photoId }, { status: 200 });
  } catch (error) {
    console.error('API Photo Delete Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo', details: error.message },
      { status: 500 }
    );
  }
}
