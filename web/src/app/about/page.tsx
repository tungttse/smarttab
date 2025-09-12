import Link from "next/link";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-gray-900">💡 Hilidea</Link>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-500 hover:text-gray-900">Home</Link>
              <Link href="/about" className="text-blue-600 font-semibold">About</Link>
              <Link href="/extension" className="text-gray-500 hover:text-gray-900">Extension</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About Hilidea</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              Hilidea is a powerful Chrome extension designed to transform the way you interact with web content. 
              By simply highlighting text on any webpage, you can instantly save it and generate creative ideas 
              and insights that help you learn, create, and innovate.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-600 mb-6">
              We believe that every piece of information you encounter online has the potential to spark new ideas. 
              Hilidea bridges the gap between consuming content and creating something meaningful from it.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Key Features</h2>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
              <li><strong>Universal Text Highlighting:</strong> Works on any website, any content</li>
              <li><strong>Gmail Integration:</strong> Secure authentication with your Google account</li>
              <li><strong>AI-Powered Idea Generation:</strong> Get creative insights from your highlights</li>
              <li><strong>Cross-Platform Sync:</strong> Access your saved content anywhere</li>
              <li><strong>Privacy-First:</strong> Your data is secure and private</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-600 mb-4">
              Hilidea uses advanced natural language processing to analyze your highlighted text and generate 
              relevant, creative ideas. Whether you're researching for a project, learning new concepts, 
              or simply browsing interesting content, Hilidea helps you extract maximum value from your reading.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Use Cases</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Students & Researchers</h3>
                <p className="text-blue-800 text-sm">
                  Capture key concepts and generate study ideas, research questions, and project topics.
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Content Creators</h3>
                <p className="text-green-800 text-sm">
                  Find inspiration for articles, videos, and social media content from your reading.
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">Entrepreneurs</h3>
                <p className="text-purple-800 text-sm">
                  Discover business opportunities and innovative solutions from industry insights.
                </p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2">Lifelong Learners</h3>
                <p className="text-orange-800 text-sm">
                  Transform passive reading into active learning with personalized idea generation.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Technology</h2>
            <p className="text-gray-600 mb-4">
              Hilidea is built with modern web technologies including Chrome Extension APIs, 
              Google OAuth 2.0, and advanced AI processing. We prioritize security, performance, 
              and user experience in every aspect of our development.
            </p>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <Link 
                href="/extension"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Get Started with Hilidea
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
