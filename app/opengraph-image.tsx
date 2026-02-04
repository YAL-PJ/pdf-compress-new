import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'PDF Compress - Free Online PDF Compressor';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          backgroundImage:
            'linear-gradient(to bottom right, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 80px',
            position: 'relative',
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              marginBottom: '32px',
              fontSize: '56px',
            }}
          >
            📄
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '72px',
              fontWeight: 800,
              color: 'white',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            PDF Compress
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: 'flex',
              fontSize: '32px',
              color: '#94a3b8',
              marginBottom: '48px',
              textAlign: 'center',
            }}
          >
            Free Online PDF Compressor
          </div>

          {/* Feature badges */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
            }}
          >
            {['100% Private', '24+ Methods', 'No Upload'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '9999px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
                <span
                  style={{
                    color: '#10b981',
                    fontSize: '20px',
                    fontWeight: 600,
                  }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
