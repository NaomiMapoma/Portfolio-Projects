"use client";

// Friendly fallback if something unexpected breaks in the browser. It shows no
// technical details and logs nothing, so no CV or job text can leak through it.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-gray-700">
        FastTrack hit an unexpected problem. Nothing has been saved or sent anywhere. Click the button to start again.
        You will need to paste or upload your CV and job description again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 font-medium text-white"
      >
        Start again
      </button>
    </main>
  );
}
