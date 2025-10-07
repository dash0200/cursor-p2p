# P2P Chat - WebRTC Peer-to-Peer Chat Application

A modern, neumorphic dark-themed React.js chat application that enables direct peer-to-peer communication using WebRTC. No servers required - users connect directly through manual signaling.

## ✨ Features

- **WebRTC P2P Connection**: Direct peer-to-peer communication without any servers
- **Manual Signaling**: Copy-paste or QR code-based connection setup
- **Real-time Chat**: Instant messaging with message history
- **File Sharing**: Send files directly between peers
- **Neumorphic Dark Theme**: Beautiful modern UI with soft shadows and depth
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **No Backend Required**: Completely client-side application
- **Connection Status**: Visual indicators for connection state

## 🚀 Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- Modern web browser with WebRTC support

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd react-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and visit `http://localhost:5173`

## 🔗 How to Connect

### Method 1: Copy-Paste Signaling

1. **Host (Peer 1)**:
   - Click "Create Offer" in the Connect tab
   - Copy the generated offer text
   - Share it with the other peer (via email, messaging, etc.)

2. **Client (Peer 2)**:
   - Paste the offer in the "Accept Connection" section
   - Click "Accept Offer"
   - Copy the generated answer
   - Share it back with the host

3. **Complete Connection**:
   - Host pastes the answer in the "Complete Connection" section
   - Click "Accept Answer"
   - Connection established!

### Method 2: QR Code (Mobile)

1. Host creates an offer and shows the QR code
2. Client scans the QR code with their mobile device
3. Follow the copy-paste process for the answer

## 🛠️ Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues

## 🎨 Design Features

- **Neumorphic Dark Theme**: Soft, modern UI with depth and shadows
- **Color Scheme**: Dark background (#1a1a1a) with green accents (#4ade80)
- **Typography**: Inter font family for clean, readable text
- **Animations**: Smooth transitions and hover effects
- **Visual Feedback**: Connection status indicators and message styling

## 📱 Responsive Design

The application is fully responsive and includes:
- Mobile-first design approach
- Adaptive navigation and layouts
- Touch-friendly interface elements
- Optimized for all screen sizes

## 🏗️ Project Structure

```
react-app/
├── public/                 # Static assets
├── src/
│   ├── App.jsx            # Main P2P chat application
│   ├── App.css            # Neumorphic dark theme styles
│   ├── index.css          # Global styles and resets
│   └── main.jsx           # Application entry point
├── package.json           # Dependencies and scripts
└── README.md             # Project documentation
```

## 🔧 Technologies Used

- **React 19** - Modern React with hooks and functional components
- **WebRTC** - Peer-to-peer communication protocol
- **Vite** - Fast build tool and development server
- **CSS3** - Neumorphic design with advanced shadows and effects
- **ESLint** - Code linting and quality assurance

## 🎯 Key Features

### Connection Management
- Create WebRTC offers and answers
- Manual signaling with copy-paste
- QR code generation for mobile sharing
- Connection status monitoring

### Chat Interface
- Real-time message exchange
- Message history with timestamps
- Different message types (local, remote, system)
- Auto-scroll to latest messages

### File Sharing
- Direct file transfer between peers
- Automatic file download
- Support for any file type
- Progress indication

## 🔒 Privacy & Security

- **No Server Storage**: All communication is direct between peers
- **No Data Logging**: Messages and files are not stored anywhere
- **End-to-End**: Communication is encrypted by WebRTC
- **Local Only**: No external services or tracking

## 🚀 Deployment

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment to any static hosting service like:
- Netlify
- Vercel
- GitHub Pages
- AWS S3

## 🌐 Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

**Note**: WebRTC requires HTTPS in production environments.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you have any questions or need help, please open an issue in the repository.

## 🔧 Troubleshooting

### Connection Issues
- Ensure both peers are using modern browsers
- Check firewall settings
- Try different STUN servers if needed
- Verify the offer/answer is copied completely

### File Transfer Issues
- Check browser file size limits
- Ensure stable connection during transfer
- Try smaller files first to test functionality