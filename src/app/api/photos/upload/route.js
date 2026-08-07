import { NextResponse } from 'next/server';

// Temporary in-memory fallback store
let photoStore = [];

/**
 * POST /api/photos/upload
 * Saves photo metadata uploaded from Cloudinary/queue
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { lotNumber, dateStr, cloudinaryUrl, publicId } = body;

    if (!cloudinaryUrl) {
      return NextResponse.json(
        { error: 'Missing required field: cloudinaryUrl' },
        { status: 400 }
      );
    }

    const formattedDate = dateStr || new Date().toISOString().split('T')[0];
    const formattedLot = lotNumber ? lotNumber.trim().toUpperCase() : 'UNNAMED-LOT';

    const newPhoto = {
      _id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lotNumber: formattedLot,
      dateStr: formattedDate,
      cloudinaryUrl,
      publicId: publicId || '',
      createdAt: new Date().toISOString()
    };

    photoStore.unshift(newPhoto);

    return NextResponse.json({ success: true, photo: newPhoto }, { status: 201 });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/photos/upload
 * Retrieves list of saved photos for the gallery
 */
export async function GET() {
  try {
    return NextResponse.json(photoStore, { status: 200 });
  } catch (error) {
    console.error('Fetch route error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve photos', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/photos/upload?id=photo_12345
 * Deletes a photo entry by ID
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    photoStore = photoStore.filter((p) => p._id !== id);

    return NextResponse.json({ success: true, deletedId: id }, { status: 200 });
  } catch (error) {
    console.error('Delete route error:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo', details: error.message },
      { status: 500 }
    );
  }
}
