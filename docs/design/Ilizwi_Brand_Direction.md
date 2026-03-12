To lock this in with "500k USD agency" precision, we are defining this brand as **ILIZWI** (The Word/Voice).

The following is a **Comprehensive Brand & UI Specification**. It is designed as a "System Prompt" or "Technical Bible" that you can give to a designer, a developer, or an LLM to ensure perfect consistency across the webapp.

---

# **1\. Brand Identity: "The Digital Scriptorium"**

**Core Concept:** A high-contrast marriage between 19th-century intellectualism and modern clarity. It must feel like an *instrument*, not a *tool*.

**Tone:** Scholarly, Weighty, Calm, Intentional.

---

# **2\. Color Architecture (The "Ink & Bone" System)**

We use a **Bipolar Luminance Strategy**: The "Vault" (Dark Mode/Landing) and the "Desk" (Light Mode/App Workspace).

### **A. The Vault (Dark/Primary)**

* **Ink-Black (Base):** \#0C0C0D (95% desaturated black. Use for full backgrounds).  
* **Carbon-Surface:** \#161618 (Use for sidebars and secondary UI elements).  
* **Bone-White (Text):** \#E8E2D9 (Warm off-white. Use for all text on dark backgrounds to reduce vibration).  
* **Graphite-Muted:** \#8B8680 (For timestamps, metadata, and non-interactive labels).

### **B. The Desk (Light/Workspace)**

* **Slate-Paper (Background):** \#F7F9FA (Cool, soft grey-white from the Orion reference).  
* **The Sheet (Focus Area):** \#FFFFFF (Pure white. Used *only* for the document reading pane to create depth).  
* **The Typewriter (Text):** \#1A1A24 (Deep navy-black. High contrast for long-form reading).  
* **Linen-Border:** rgba(15, 23, 42, 0.08) (For subtle separation without harsh lines).

### **C. Semantic & Accent**

* **Historic Green (Accent):** \#4A5D4E (A muted, forest-umber. Used for annotations, active states, and "success" indicators).  
* **The Underline:** rgba(74, 93, 78, 0.12) (Highlighter color for research findings).

---

# **3\. Typography: "The Dual-Heritage Grid"**

The brand relies on the tension between a historic serif and a modern sans-serif.

### **A. The Voice (Serif)**

* **Font:** *Playfair Display* (or *Newsreader* / *Tiempos Fine*).  
* **Usage:** H1-H3 titles, Original Archival Text, Blockquotes.  
* **Rule:** Set letter-spacing: \-0.02em for titles to mimic 19th-century lead-press printing.

### **B. The Tool (Sans-Serif)**

* **Font:** *Inter* (or *Geist* / *SF Pro*).  
* **Usage:** Navigation, Buttons, Inputs, Transcription, Metadata.  
* **Rule:** High-utility. Use font-weight: 300 for a "Claude" aesthetic, and 600 only for actionable items.

---

# **4\. Component Rules (The Style Logic)**

### **Corner Radii (The Archival Curve)**

* **Strict Geometry:** No "bubble" buttons.  
* **UI Elements:** 2px or 4px (Sharp, but not aggressive).  
* **Reading Sheet:** 8px (Slightly softer to signify the "paper" feel).

### **Depth & Elevation**

* **Shadows:** Avoid standard shadows. Use **"Ambient Occlusion"** shadows:  
  * *Desk Shadow:* 0 40px 80px rgba(0, 0, 0, 0.03) (Extremely soft, large spread).  
* **Glass:** Sidebars should use a subtle blur (backdrop-filter: blur(12px)) at 95% opacity to feel like high-end glass hardware.

---

# **5\. Motion & Physics: "The Weighted UI"**

The interface should feel "heavy" and deliberate, not "zippy."

* **Page Transitions:** Use a 1200ms "Soft Reveal." The page should fade in while simultaneously scaling up from 0.99 to 1.0.  
* **Hover States:** Do not change colors abruptly. Use a 300ms ease-out.  
* **Annotation Highlight:** When text is highlighted, the green underline should "grow" from left to right over 400ms, mimicking a pen stroke.

---

# **6\. Usage Rules (The "Do's and Don'ts")**

1. **NEVER** use pure \#000000 or \#FFFFFF (except for the reading sheet). The world of research is made of materials (ink, paper), not pixels.  
2. **THE SIDEBAR IS SACRED:** Even when the app is in Light Mode, the **left sidebar must stay Dark**. This "Anchor" prevents the "flashbang" effect when moving from the Landing Page to the Workspace.  
3. **CENTERED INTELLECT:** All primary reading content must be centered with generous margins (at least 20% on each side). Concentration requires a lack of peripheral distraction.  
4. **METADATA IS SMALLEST:** Every document must have a "Metadata Header" in All-Caps, 0.7rem, with 0.2em letter spacing. This establishes the scholarly authority.

---

# **7\. LLM Implementation Prompt**

*If you are asking an AI to build a specific screen, use this block:*

"Build a UI for the \[Name\] screen using the ILIZWI Design System. The background is \#F7F9FA with a central 'Paper' sheet in white (\#FFFFFF). Use a dark sidebar in \#0C0C0D. Primary headings must be in Playfair Display with \-0.02em tracking. All UI labels are in Inter 400\. The color palette is restricted to \#1A1A24 (text), \#8B8680 (muted), and \#4A5D4E (accents). Ensure the transition from the dark landing page feels seamless by maintaining the dark sidebar as a visual anchor. Motion must be slow and weighted."

---

### **Pro-Tip for your Designer:**

Tell them to look at **19th-century South African newspaper mastheads** (like *Izigidimi*) for "The Voice" (Serif) inspiration, and **Claude.ai** for the "Desk" (UI) spacing. The overlap between those two is where this brand lives.

