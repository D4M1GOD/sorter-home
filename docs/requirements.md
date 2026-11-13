# SorterHome — Requirements (v0.9)

Last updated: 2026-11-08
Status: Requirements for v1 are agreed. Items marked **Open** still need a decision from the project owner.

## 1. Purpose
A web app to organize storage containers at home and know exactly what is inside each one and where it is. The name leaves room for more home-organization features later.

- **Primary user (now):** the project owner.
- **Target users:** families organizing their home, or families who are moving.
- **Second goal:** portfolio project for a software engineering job search: large tech companies (for example Microsoft or Google), remote, and companies in Columbus, Ohio. A varied stack is a plus.
- **Possible later goal:** commercial product. Not planned for now, but decisions should not close that door.

## 2. Platform and language
- Responsive web app that works on both phone and desktop.
- UI language: **English**.
- Online first. Offline support comes later (see section 7).

## 3. Core concepts
| Concept | Description |
|---|---|
| **Room** | A named area, for example "Garage", drawn as a floor plan with **real dimensions**. The user resizes it by dragging its edges or corners, the way you stretch a frame in Figma or a canvas in Paint. |
| **Grid** | A semi-transparent guide drawn over the room. Each square is **1 ft × 1 ft**. It is a visual ruler: containers are not forced to fill whole squares. |
| **Container** | A physical box placed on the room plan, drawn at its **real footprint**, so a bigger container takes up more of the plan. It has a name, a position, a rotation and a stack position. v1 type: **Tough Box 27 gal**, outside dimensions 30.5 × 20.5 × 14.25 in (≈ 77.5 × 52 × 36 cm), about 2.5 × 1.7 grid squares. |
| **Stack** | Containers can sit one on top of another. There is **no height limit**, and **order matters** (bottom → top). Dropping a container onto another one adds it to the top of that stack. |
| **Item** | One physical object inside one container. It is tracked item by item (no layers). |

### Container fields
- Name: required, at most 60 characters, trimmed. A new container gets an automatic name (`Container 1`, `Container 2`, ...: the lowest number not already used in that room) that the user can change.
- A container has **no photo, description or category of its own**. Those belong to its items.
- Position, rotation and stack position (see the functional requirements).

### Item fields
The container panel has an **"Add item"** button (phase 3). Each item has:
- Name (required)
- Quantity (required): a whole number, **pre-filled with 1** in the form. **Open:** allowed range (proposal: 1 to 9999).
- Description (optional): free text for details that the name does not cover, for example "USB-C cable, 2 m, white". **Open:** multi-line text with a 500 character limit; whether search also looks inside descriptions.
- Category (optional): a single category per item, written as free text **with suggestions** taken from the categories already used. Matching ignores upper/lower case ("Navidad" and "navidad" are the same category) and a new item reuses the spelling of the existing category. **Open:** maximum length (proposal: 40), and whether categories are global across rooms (proposal: yes).
- Photo: **optional but recommended**. Exactly one photo per item, taken with the phone camera or uploaded as a file. The UI should encourage adding one (for example a clear "Add photo" prompt on items without a photo).

### Photos before the backend exists
localStorage holds about 5 MB in total and one phone photo weighs 2 to 5 MB, so photos cannot live there. Photos are built as their own step, stored in the browser's **IndexedDB** behind a service and **reduced in size before saving**. When the backend exists, they move to Azure Blob Storage (photos saved only in the browser are not migrated).

## 4. Units of measure
- **Storage:** every length is stored in **whole millimeters** (integers). This avoids rounding errors and keeps the data independent of the display unit.
- **Display (v1):** imperial, feet and inches.
- **Later:** the user chooses imperial or metric. Only the display and input layer changes; the stored data does not. In metric, the grid square would be 25 cm and the snap step 1 cm.
- The code must never hard-code a display unit outside the formatting/parsing layer, so the switch stays easy.
- 1 ft = 304.8 mm and 1 in = 25.4 mm are not whole numbers. Every conversion into stored data rounds to the nearest whole millimeter (error under 0.5 mm). Grid lines are only a drawing guide and may sit at fractional millimeter positions.

## 5. Functional requirements (v1)
### Rooms and plan
- FR-1: Create, rename and delete rooms. The room name is required, at most 60 characters, and two rooms may have the same name.
- FR-1b: A new room starts at **12 ft × 10 ft** (3658 × 3048 mm). Minimum size **4 ft × 4 ft** (1219 × 1219 mm). Maximum size **100 ft × 100 ft** (30480 × 30480 mm).
- FR-2: Resize a room by dragging its right edge, its bottom edge or its bottom-right corner (the top-left corner stays fixed). The size changes in 1 in steps, stays between 4 ft and 100 ft, shows a live size readout while dragging, and is saved when the pointer is released. Works with mouse and touch. An edge cannot be dragged past the containers inside the room: **to be implemented in phase 2, once containers exist**.
- FR-3: Show a semi-transparent grid with 1 ft squares.

### Containers
- FR-4: Add a container from a toolbox at the bottom of the plan. The toolbox shows each container type as a square tile with a drawn SVG icon (top view of the box). The user drags a tile onto the plan; the container appears at its real size, with the **center under the pointer**, and its top-left corner snapped to 1 in. While dragging, a **shadow of the container footprint** shows where it will land: **green** when the place is valid and **red** when it is not (it would leave the room or overlap another container). The state must not rely on color alone. Dropping on red creates nothing.
- FR-4b: Tapping or pressing a toolbox tile places the container in the first free spot, scanning from the top-left corner in 1 ft steps. If there is no free space, a message says so. This also serves touch screens and keyboards.
- FR-4c: A container can never leave the room walls. Until stacking exists (FR-7), any overlap between containers is blocked. A room cannot be resized smaller than the containers inside it (the edge stops at the containers).
- FR-5: Move a container. While dragging, it snaps to 1 in steps so it is easy to align.
- FR-6: Rotate a container 90°. Rotation swaps its length and width on the plan.
- FR-7: Stack containers by dropping one onto another, view the stack order, and change it.
- FR-8: Select a container to open its panel: on the **right** of the plan on wide screens and **below** the plan on narrow screens (phones). The panel shows the container name (editable) and a delete button with an inline confirmation (no browser dialogs). Rotate (FR-6) and Add item (phase 3) are added to this panel in their own steps.

### Items
- FR-9: Add items to a container with the "Add item" button (name, quantity, optional description, optional category, optional photo).
- FR-10: Edit an item, change its quantity, and remove it.

### Search (phase after items)
- FR-11: Search items by name and filter by category and room. Each result shows the location: room → container → stack level.

## 6. Non-functional requirements
- Photos are stored in file/object storage. The database stores only a reference to the photo.
- Public GitHub repository with automated checks (CI).
- Code, UI and README in English.

## 7. Out of scope for now (planned later)
- User-selectable unit system (see section 4).
- User accounts, login, and sharing a household with family members.
- Offline mode.
- Moving mode (packed / in transit / unpacked, destination room).
- More container types. **Open (later):** stacking rules when containers of different sizes are stacked.
- QR labels for containers, with a short human-readable code (for example `GAR-03`) printed on the label. QR was chosen over NFC because Web NFC only works in Chrome on Android.

## 8. Project setup (confirmed)
| Topic | Decision |
|---|---|
| Product name | SorterHome |
| Repository | Monorepo, public: `github.com/D4M1GOD/sorter-home` |
| Structure | `frontend/` (Angular), `backend/` (ASP.NET Core), `docs/` |
| License | None for now (all rights reserved), to keep the commercial option open. An open-source license can be added later. |
| Local folder | `C:\Users\D10S_\Desktop\PROJECTS\sorter-home` |
| Default branch | `main` |
| Commit messages | Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…) |

## 9. Development environment (confirmed)
- OS: Windows; editor: Visual Studio Code (Visual Studio 2022 is also installed)
- AI assistant: Claude (claude.ai Project + Claude Code in VS Code)
- Installed tools: Git 2.56, Node.js 24.22, Angular CLI 22.2, .NET SDK 10.0 (LTS), Docker 29.9, Claude Code 2.1
- Owner's experience: Angular, JavaScript, TypeScript; 6 months of professional work.

## 10. Technology stack
| Layer | Choice | Status |
|---|---|---|
| Frontend | Angular + TypeScript | Confirmed |
| Backend | C# with ASP.NET Core Web API on .NET 10 | Confirmed |
| Database | PostgreSQL | Proposed |
| Local services | Docker Desktop (PostgreSQL and the Azure Storage emulator) | Proposed |
| Photos | Azure Blob Storage | Proposed |
| Hosting | Azure | Proposed |
| Code and CI | GitHub + GitHub Actions | Proposed |
| Drawing the room plan | **SVG** inside Angular templates, with pointer events written by hand (no drawing library) | Confirmed |

## 11. Rendering decision
The room plan is drawn with SVG. Reasons: the plan has tens of objects (not thousands), SVG elements bind directly to Angular data, and the SVG `viewBox` can use **millimeters**, the same unit as the stored data. Drag, resize, snap and rotate are implemented with pointer events. Data and drawing stay separate (a plain model in mm; SVG components only render it), so a library could replace the drawing layer later without changing the model.

## 12. Pages, routes and temporary storage (phase 1)
| Route | Page |
|---|---|
| `/` | Home: "Create Room" and "Explore Rooms" |
| `/rooms/new` | Create Room: name form. On success, goes straight to the new room's plan page |
| `/rooms` | List of rooms: name, size, Open, Delete (with inline confirmation) |
| `/rooms/:id` | Room plan page: where all room editing lives (rename now; resize, containers and items in later steps) |
| anything else | Redirects to `/` |

- `/rooms/new` is declared before `/rooms/:id`, otherwise "new" would be read as a room id.
- **Temporary storage:** rooms are kept in the browser's localStorage (key `sorterhome.rooms.v1`) through `RoomStore`. Stored data is validated on load and invalid entries are discarded. This storage is per browser: it is not shared across devices or people.
- **Replacing it later:** when the backend exists, `RoomStore` is replaced by calls to the API. The routes stay the same. The pages will need loading and error states because network calls are asynchronous.
- **Frontend conventions (Angular 22):** Signal Forms, the `@Service` decorator, lazy-loaded routes, Vitest for tests. Pages live in `src/app/pages/`, shared logic in `src/app/core/`.

## 13. Roadmap (simple → complex)
0. Setup: tools, GitHub repository, Claude project, CLAUDE.md — **done**. The Angular frontend is scaffolded (SCSS, routing, no SSR).
1. Rooms as resizable floor plans with a 1 ft grid — **done**: plan drawing, pages, local storage and resizing by dragging.
   - Planned improvements to the plan view: zoom and pan (the view is frozen while dragging, so growing a room a lot takes several drags); resizing with the keyboard (accessibility); resize handles on the left and top edges (needs a rule for moving the containers inside, so it waits until containers exist).
2. Containers on the plan:
   - 2.1 Container model, SVG toolbox, drag with green/red shadow, tap to add, name panel, delete, room cannot shrink under containers — **done**
   - 2.2 Move containers with 1 in snap, rotate 90° — **done**
   - 2.3 Stacking, stack order
3. Items: name, quantity, description, category, photo (the photo comes as its own step, with IndexedDB)
4. Search and filters
5. Deploy to the internet with CI
6. QR labels
7. User accounts and shared households
8. Offline mode
9. Metric/imperial choice, more container types, moving mode

### Planned improvements / known issues
- Keyboard alternative to dragging for moving containers (WCAG 2.2, criterion 2.5.7), planned together with the keyboard resize of the room that is already listed in step 1.
- The rename-room page shows an empty paragraph for the maximum-length error.
- Review the short UI texts "Valid / Overlaps / Outside room".
- Verify touch gestures on real devices (Android Chrome, iOS Safari) once the app is deployed; the browser emulation does not reproduce iOS Safari.
