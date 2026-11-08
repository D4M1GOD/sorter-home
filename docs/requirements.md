# SorterHome — Requirements (v0.4)

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

### Item fields
- Name (required)
- Quantity (required)
- Category (optional)
- Photo: **optional but recommended**. Exactly one photo per item, taken with the phone camera or uploaded as a file. The UI should encourage adding one (for example a clear "Add photo" prompt on items without a photo).

## 4. Units of measure
- **Storage:** every length is stored in **whole millimeters** (integers). This avoids rounding errors and keeps the data independent of the display unit.
- **Display (v1):** imperial, feet and inches.
- **Later:** the user chooses imperial or metric. Only the display and input layer changes; the stored data does not. In metric, the grid square would be 25 cm and the snap step 1 cm.
- The code must never hard-code a display unit outside the formatting/parsing layer, so the switch stays easy.

## 5. Functional requirements (v1)
### Rooms and plan
- FR-1: Create, rename and delete rooms.
- FR-2: Resize a room by dragging its edges or corners. The room shows its real size (for example 12 ft × 10 ft). An edge cannot be dragged past the containers inside the room.
- FR-3: Show a semi-transparent grid with 1 ft squares.

### Containers
- FR-4: Add a container from a toolbox by dragging it onto the room plan. It appears at its real size.
- FR-5: Move a container. While dragging, it snaps to 1 in steps so it is easy to align.
- FR-6: Rotate a container 90°. Rotation swaps its length and width on the plan.
- FR-7: Stack containers by dropping one onto another, view the stack order, and change it.
- FR-8: Name and delete a container.

### Items
- FR-9: Add items to a container (name, quantity, optional category, optional photo).
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
| Drawing the room plan | SVG, HTML canvas or a library | To decide in phase 1 |

## 11. Roadmap (simple → complex)
0. Setup: tools, GitHub repository, Claude project, CLAUDE.md
1. Rooms as resizable floor plans with a 1 ft grid
2. Containers on the plan: drag with snap, rotate, stack order
3. Items: name, quantity, category, photo
4. Search and filters
5. Deploy to the internet with CI
6. QR labels
7. User accounts and shared households
8. Offline mode
9. Metric/imperial choice, more container types, moving mode
