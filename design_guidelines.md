# Design Guidelines: Stripe Payment Link Generator

## Design Approach
**System-Based Approach** inspired by Stripe's design principles - clean, minimal, trustworthy interfaces that prioritize clarity and speed. This utility-focused tool demands efficiency over decoration.

## Typography System
- **Primary Font**: Inter (Google Fonts) - modern, highly legible
- **Hierarchy**:
  - Headings: font-bold, text-4xl (h1), text-2xl (h2)
  - Body: font-normal, text-base
  - Labels: font-medium, text-sm
  - Monospace for links/code: font-mono, text-sm

## Layout & Spacing
**Spacing Primitives**: Use Tailwind units of **2, 4, 6, and 8** consistently
- Component padding: p-6 to p-8
- Section spacing: space-y-6
- Form fields: space-y-4
- Button padding: px-6 py-3

**Container Strategy**:
- Centered single-column layout: max-w-2xl mx-auto
- Full-page centered vertically: min-h-screen flex items-center
- Card-based main interface with subtle elevation

## Component Library

### Primary Form Interface
- **Input Field**: Large, clear text input for price amount
  - Prefix with "$" symbol inside input (absolute positioning)
  - Border focus states with smooth transitions
  - Helper text below: "Enter amount in USD"
  - Size: h-12, rounded-lg

- **Generate Button**: Primary CTA, full-width or prominent
  - Size: h-12, rounded-lg, font-medium
  - Loading state with spinner when processing
  - Disabled state while generating

### Link Display Component
- **Generated Link Card**: Appears after successful generation
  - Monospace font for the URL
  - Copy button with icon (use Heroicons via CDN)
  - Success indicator (checkmark icon)
  - Visual separation with border/background treatment

### Navigation & Layout
- **Header**: Minimal top bar
  - Logo/app name: text-xl font-bold
  - Optional: Link to documentation
  - Height: h-16, px-6

- **Footer**: Simple centered text
  - "Powered by Stripe" with link
  - py-8, text-sm

### State Components
- **Success State**: Checkmark icon + "Link generated successfully"
- **Error State**: Alert icon + error message in red-themed container
- **Loading State**: Spinner + "Generating payment link..."

## Page Structure
Single-page application with centered card design:

1. **Hero/Header Section** (py-12)
   - App title: "Payment Link Generator"
   - Subtitle: "Create secure Stripe payment links instantly"
   - No background image needed - clean, focused

2. **Main Card** (max-w-2xl, p-8, rounded-2xl with shadow)
   - Price input field
   - Generate button
   - Conditional: Generated link display area
   - Conditional: Success/error messages

3. **Footer** (py-8)
   - Minimal branding/attribution

## Micro-interactions
- Input focus: smooth border transition
- Button hover: subtle scale (scale-105)
- Copy button: Tooltip "Copied!" on click
- Form submission: Button transforms to loading state

## Icons
Use **Heroicons** (outline style) via CDN:
- Currency dollar (input prefix)
- Check circle (success)
- Exclamation circle (error)
- Clipboard copy (copy button)
- Loading spinner

## Accessibility
- All inputs have associated labels (sr-only if visually hidden)
- Focus states clearly visible on all interactive elements
- ARIA labels for icon-only buttons
- Error messages linked to inputs via aria-describedby

## Images
**No hero image required** - this is a utility tool where clarity trumps visual flair. The interface should feel like a professional dashboard widget - clean, spacious, immediately usable.

---

**Design Philosophy**: Stripe-inspired minimalism meets modern SaaS clarity. Every pixel serves the user's goal: generating payment links quickly and confidently. Zero decoration, maximum utility.