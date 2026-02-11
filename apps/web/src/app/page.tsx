export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">PMS</h1>
      <p className="text-lg text-gray-600">
        Open Source Property Management System
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/rooms"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Rooms
        </a>
      </div>
    </main>
  );
}
