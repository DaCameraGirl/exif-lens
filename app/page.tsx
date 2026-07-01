import ExifLens from './components/ExifLens';

export const metadata = {
  title: 'EXIF Lens – by DaCameraGirl',
  description: 'Beautiful, private, local-only EXIF metadata viewer for photographers. Drag a photo in, see every camera setting.',
};

export default function Home() {
  return <ExifLens />;
}
