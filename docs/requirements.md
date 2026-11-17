# SorterHome — Requirements (v0.16)

Last updated: 2026-11-16
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
| **Item** | One physical object inside one container. It is tracked item by item (no layers). Some or all of its units can be out of the container for a while without losing their place. |

### Container fields
- Name: required, at most 60 characters, trimmed. A new container gets an automatic name (`Container 1`, `Container 2`, ...: the lowest number not already used in that room) that the user can change.
- A container has **no photo, description or category of its own**. Those belong to its items.
- Position, rotation and stack position (see the functional requirements).

### Item fields
The container panel has an **"Add item"** button (phase 3). Each item has:
- Name (required): at most **60 characters**, trimmed (the same rule as room and container names). Two items in the same container may share a name.
- Quantity (required): a whole number from **0 to 9999**, **pre-filled with 1** in the form. An item with quantity 0 stays in its container and shows the label "None left", so the user still knows where it belongs and what to restock.
- Description (optional): free text for details that the name does not cover, for example "USB-C cable, 2 m, white". Multi-line text, at most **500 characters**. **Open (phase 4):** whether search also looks inside descriptions.
- Category (optional): a single category per item, written as free text **with suggestions** taken from the categories already used, at most **40 characters**, trimmed. Categories are **global across rooms**. There is no separate list of categories: the suggestions come from the existing items, so a category stops being suggested when its last item is removed. A saved category is trimmed and its inner runs of spaces become one space. Matching ignores upper/lower case, accents (diacritics) and repeated spaces: "Jardín", "jardin" and "Jardin" are the same category, and so are "Navidad" and "navidad". A new item reuses the spelling of the existing category. When an item is edited, its category is compared with the categories of all the **other** items: if one of them already uses it, that spelling is reused; if no other item uses it, what the user typed is saved, so the spelling of a category with a single item can be corrected. Editing one item never changes the other items; renaming a category across all its items is not possible yet.
- Photo: **optional but recommended**. Exactly one photo per item, taken with the phone camera or uploaded as a file. The UI encourages adding one: an item without a photo shows an "Add photo" button in its row. The photo is chosen with two buttons. "Add photo" opens the file picker (`<input type="file" accept="image/*">`, without `capture`) on every device: on a computer it opens the files, and on a phone it opens the gallery (tested on Chrome for Android, where that picker does not offer the camera). "Take photo" opens the camera (a second `<input type="file" accept="image/*" capture="environment">`, the rear camera) and is shown **only on touch screens**, those where the media query `(pointer: coarse)` is true; on a computer there is one button. `capture` is a hint: a browser that ignores it opens the file picker. The chosen file can weigh at most **30 MB**. Two versions are saved, both **JPEG**: a thumbnail (long side 320 px, about 20 KB) for the list, and a full version (long side 1280 px, quality 0.8). A small image is never enlarged, and the photo is saved upright (the EXIF orientation is respected). The item keeps only the id of its photo (`photoId`).
- Items from photos: several photos can be chosen at once ("Add several photos", see FR-9) and each one becomes an item named `Item 1`, `Item 2`, ... (the lowest number not used in that container), with quantity 1, no description, no category and its photo. The user completes them later with "Edit". Nothing marks them as items to complete: the default name, the quantity 1 and the photo tell them apart.

### Items that are out of their container
An item can leave its container without losing its place.
- **Model:** the quantity of an item is the **total** the user owns: the units inside the container plus the units that are out. A second number, the units out (`quantityOut`), goes from 0 to the quantity. The units inside are the quantity minus the units out.
- **Take out:** the user says how many units leave the container (pre-filled with all the units that are inside). The item stays in the list of its container and shows how many units are out, for example "20 of 100 out".
- For the units that are out, the user chooses **Put back** (they return to the container) or **Used** (they will not return, so the total quantity goes down by that number).
- Example, things that come back: "Christmas lights", quantity 4. Take out 4 shows "4 of 4 out"; in January, Put back 4.
- Example, things that are used up: "Nails", quantity 100. Take out 20 shows "20 of 100 out"; 15 were used and 5 were left over, so Put back 5 and Used 15. The item becomes "Nails", quantity 85.
- **Using units without taking them out:** units that are inside can be marked as used directly. The total quantity goes down by that number and the units out do not change. Example: "Nails", quantity 100, none out. Mark 15 as used: the item becomes "Nails", quantity 85, none out.
- When the total reaches 0 the item stays in its container and shows "None left".
- Editing the quantity directly (FR-10) stays available for corrections. The units out do not change when an item is edited, so a quantity lower than the units that are out is **blocked** with the error "Quantity can't be lower than the units that are out (N)." Nothing is adjusted silently: to reach quantity 0 the user first uses "Used" or "Put back".
- There is no undo: a mistaken "used" is corrected by editing the quantity.
- **Open (phase 4):** how search results show that an item is out, and a filter for the items that are out.

### Photos before the backend exists
localStorage holds about 5 MB in total and one phone photo weighs 2 to 5 MB, so photos cannot live there. Photos are stored in the browser's **IndexedDB** behind a service (`PhotoStore`) and **reduced in size before saving**. When the backend exists, they move to Azure Blob Storage (photos saved only in the browser are not migrated).
- **Service:** the pages and components only use `PhotoStore` (save, load, delete, delete all except the ones in use), which is asynchronous. IndexedDB is behind it, so the backend can replace it later. The two versions of a photo are saved together, in one transaction: both or neither.
- **Saving:** the photo is saved first and the item after it. If the photo cannot be saved (for example when the storage is full), the form shows "Couldn't save the photo." and the item is **not** saved. If the item is then not saved, the photo is deleted. When several photos are added at once (see FR-9) each photo is saved before its item, and the photos are prepared and saved one at a time, to keep the memory low.
- **Photos nobody uses:** the photos of an item are deleted when the item, its container or its room is deleted, and when a photo is replaced or removed. This is done by a service that watches the rooms and deletes the photos whose id is no longer used. When the app starts, the photos that no item uses are deleted too, in one transaction (all or nothing). That startup cleanup does **not** run when the saved rooms could not be read, because the list of rooms is empty then and every photo would look unused.
- **A photo that is missing:** an item whose `photoId` points to a photo that does not exist (the browser deleted its data, or it cannot be read) is shown as an item without a photo, with the "Add photo" button. The saved id is not rewritten until the user saves the item again.
- **While a photo loads:** the row reserves the square of the thumbnail at once and the image appears when it is loaded. The photo window says "Loading photo…", and "Couldn't load the photo." if it fails.
- **Memory:** every temporary address created to show a photo (object URL) is revoked when the photo changes and when the component that shows it is destroyed.

## 4. Units of measure
- **Storage:** every length is stored in **whole millimeters** (integers). This avoids rounding errors and keeps the data independent of the display unit.
- **Display (v1):** imperial, feet and inches.
- **Later:** the user chooses imperial or metric. Only the display and input layer changes; the stored data does not. In metric, the grid square would be 25 cm and the snap step 1 cm.
- The code must never hard-code a display unit outside the formatting/parsing layer, so the switch stays easy.
- 1 ft = 304.8 mm and 1 in = 25.4 mm are not whole numbers. Every conversion into stored data rounds to the nearest whole millimeter (error under 0.5 mm). Grid lines are only a drawing guide and may sit at fractional millimeter positions.

## 5. Functional requirements (v1)
### Rooms and plan
- FR-1: Create, rename and delete rooms. The room name is required, at most 60 characters, and two rooms may have the same name. Deleting a room deletes its containers and their items, and the photos of those items. The inline confirmation in the room list says what the room contains, with singular and plural forms: `"Garage" has 3 containers and 12 items. Delete it and everything inside? This cannot be undone.`; when no container has items: `"Garage" has 3 containers. Delete it and everything inside? This cannot be undone.`; an empty room keeps `Delete "Garage"? This cannot be undone.` The numbers are counts of containers and of items (rows), not sums of quantities.
- FR-1b: A new room starts at **12 ft × 10 ft** (3658 × 3048 mm). Minimum size **4 ft × 4 ft** (1219 × 1219 mm). Maximum size **100 ft × 100 ft** (30480 × 30480 mm).
- FR-2: Resize a room by dragging its right edge, its bottom edge or its bottom-right corner (the top-left corner stays fixed). The size changes in 1 in steps, stays between 4 ft and 100 ft, shows a live size readout while dragging, and is saved when the pointer is released. Works with mouse and touch. An edge cannot be dragged past the containers inside the room: it stops at them (see FR-4c).
- FR-3: Show a semi-transparent grid with 1 ft squares.

### Containers
- FR-4: Add a container from a toolbox at the bottom of the plan. The toolbox shows each container type as a square tile with a drawn SVG icon (top view of the box). The user drags a tile onto the plan; the container appears at its real size, with the **center under the pointer**, and its top-left corner snapped to 1 in. While dragging, a **shadow of the container footprint** shows where it will land: **green** when the place is valid and **red** when it is not (it would leave the room or overlap another container). The state must not rely on color alone. Dropping on red creates nothing.
- FR-4b: Tapping or pressing a toolbox tile places the container in the first free spot, scanning from the top-left corner in 1 ft steps. If there is no free space, a message says so. This also serves touch screens and keyboards.
- FR-4c: A container can never leave the room walls. Containers cannot overlap, except by stacking (FR-7): any other overlap is blocked. A room cannot be resized smaller than the containers inside it (the edge stops at the containers). A stack counts as one footprint.
- FR-5: Move a container. While dragging, it snaps to 1 in steps so it is easy to align.
- FR-6: Rotate a container 90°. Rotation swaps its length and width on the plan.
- FR-7: Stack containers by dropping one onto another, view the stack order, and change it. A stack is a group of containers with the same position and rotation; a container alone is a stack of one. The rules are:
  - **Dropping:** a container is stacked when the **pointer** is inside the footprint of another container at the moment of the drop, both for a new container dragged from the toolbox and for an existing container being moved. The dropped container takes the position and rotation of that stack and goes **on top**. There is no height limit. Levels are counted from the bottom: level 1 is the bottom container. Tapping a toolbox tile never stacks (FR-4b). If the pointer is not inside another container but the footprints overlap, the drop is red and nothing happens (FR-4).
  - **Shadow:** while dragging, the shadow shows the aligned place with its own state (blue, dotted outline) and the text "Stack on <name>" and "Level N", where N is the level the container would take. The state never relies on color alone.
  - **Plan:** only the top container of a stack is drawn, with a badge showing the number of containers (for example "x3"). Clicking a stack selects its top container.
  - **Moving:** dragging a stack moves the whole stack. Dropping a stack of more than one container onto another container is blocked (red, with an explanatory text). Merging stacks is a possible future improvement.
  - **Rotating:** rotating a container that is in a stack rotates the whole stack around the center of its footprint, with the rule of FR-6: if it does not fit, the rotation is blocked and the message "Not enough space to rotate" is shown.
  - **Panel:** for a container in a stack, the panel lists the stack from top to bottom with the level of each container, and highlights the selected one. Clicking an item selects that container: this is how the hidden lower containers are reached. The order is changed with the "Move up" and "Move down" buttons, not by dragging. The "Remove from stack" button takes the selected container out of the stack and puts it, with the rotation of the stack, in the first free spot (as in FR-4b); if there is none, the "no free space" message is shown and nothing changes.
  - **Deleting** a container in the middle of a stack closes the gap and renumbers the levels.
  - Only one container type exists, so there are no rules for stacking containers of different sizes (see section 7).
- FR-8: Select a container to open its panel: on the **right** of the plan on wide screens and **below** the plan on narrow screens (phones). The panel shows the container name (editable), the stack list and its buttons when the container is in a stack with others (FR-7), a "Rotate 90°" button (FR-6) and a delete button with an inline confirmation (no browser dialogs). Deleting a container deletes its items too, and their photos: when the container has items, the confirmation says how many, `"Container 1" has 5 items. Delete it and its items? This cannot be undone.` (for one item: `has 1 item. Delete it and its item?`). The number is the count of items (rows), not the sum of their quantities. A container without items keeps `Delete "Container 1"? This cannot be undone.` The panel also has the items of the container (FR-9). The order of the panel is: name, stack list, Rotate 90°, items, Delete.

### Items
- FR-9: Add items to a container with the "Add item" button (name, quantity, optional description, optional category, optional photo), or several photos at once with the "Add several photos" button. The panel of the selected container lists its items.
  - **Section:** the panel has an "Items (N)" section, where N is the number of items of the container, with the "Add item" and "Add several photos" buttons (on a line that wraps when they do not fit) and then the list. The list has no scroll of its own: it grows with the page.
  - **Form:** the form opens inside the panel, in place of the "Add item" button, with the focus on "Name"; on phones the view scrolls to the form. The quantity is a text field with a numeric keyboard: a value that is not a whole number from 0 to 9999 gives an error and nothing is rounded. The description shows a counter (for example "123/500"). The category field suggests the categories already used through a native `<datalist>`.
  - **Photo field:** after the category, the form has the field "Photo (optional)". Without a photo it shows the button "Add photo", which opens the file picker, and on touch screens also "Take photo", which opens the camera. With a photo it shows a preview and the buttons "Replace" (file picker, accessible name "Replace photo"), on touch screens "Take photo" (camera), and "Remove" (accessible name "Remove photo"), in that order. "Take photo" has the same text with and without a photo and its accessible name is its visible text. The buttons wrap onto several lines when they do not fit. The touch screen is checked once when the app starts and again whenever it changes, so the button appears or disappears without reloading. A photo chosen with the file picker or taken with the camera goes through the same steps: the chosen file is reduced in size at once, to show the preview, and while that happens the field says "Preparing photo…" and "Add" or "Save" does nothing. Nothing is saved until "Add" or "Save". **Focus:** after a valid photo, the focus stays on the button that opened the picker when it is still there ("Replace" or "Take photo" when the form already had a photo), and goes to "Replace" when it was replaced by the preview ("Add photo", or "Take photo" when there was no photo). After a file error the focus goes back to the button that opened the picker ("Add photo", "Replace" or "Take photo"). After "Remove" it goes to "Add photo". After "Add", the clean form has no photo.
  - **Photo errors:** "This file is not an image." (the file is not `image/*`), "This photo is too large. The maximum is 30 MB.", "Couldn't read this image. Try a JPEG or PNG photo." (the browser cannot decode it, for example a HEIC photo outside Safari) and "Couldn't save the photo." (see "Photos before the backend exists"). A file with a problem leaves the photo of the form as it was.
  - **Several photos:** the "Add several photos" button, next to "Add item", opens the file picker with several files (`<input type="file" accept="image/*" multiple>`, without `capture`, which does not allow several files; to use the camera the user takes the photos with the camera app and then chooses them all together). The button is available on every device. The "Add item" form takes the place of both buttons while it is open, so a batch cannot start then. Under the buttons a fixed hint says "Up to 20 photos at a time." (the number is the limit of the batch): it is shown and hidden together with the buttons, it is linked to the "Add several photos" button with `aria-describedby` so a screen reader reads it with the button (the name of the button does not change), and it is plain small text that wraps. The file picker of the system cannot limit how many photos are chosen, so the limit is also checked after choosing. The photos are handled in the order the browser gives them, **at most 20 at a time**: if more are chosen the first 20 are used. For each photo, one at a time, the file is checked and reduced in size (the rules and errors of the photo field, see "Photo errors" above), its photo is saved, and then an item is added to the container, in that order. The item is named `Item N`, where N is the lowest positive number that no item of that container uses (names are compared ignoring upper/lower case, and the items created earlier in the same batch count), with quantity 1, no description, no category and its photo. A photo that fails (not an image, too large, cannot be read, cannot be saved, or the store does not accept the item) does not stop the others and does not use a number; if the item is not saved, its photo is deleted.
    - **Messages** (the status line of the items section, which screen readers announce): while it works `Preparing photo 3 of 9…`; at the end `Added 9 photos.` (`Added 1 photo.`), or `Added 7 of 9 photos. 2 failed.` followed by a list with each failed file and its reason (`IMG_0123.jpg: This file is not an image.`; the reason of an item the store does not accept is `Couldn't add the item.`); when more than 20 were chosen it adds `The other 7 were not added: the maximum is 20 photos at a time.` The progress has priority over other messages while the batch runs, and the summary, like every message, disappears when another action starts or another container is selected.
    - **While it runs:** the items appear in the list one by one, so the rows may move. The button is unavailable (`aria-disabled`, it keeps the focus) and a second batch cannot start. "Add several photos" is **not one of the actions of "one at a time"** (FR-10): starting a batch does not close or discard a form that is open in a row (the edit form, the delete confirmation, or the take out, put back or used form), and the user can keep working with it while the batch runs. There is no Cancel button, but if the user selects another container, or the container is deleted, the batch stops: the items already created stay and nothing is reported. The focus goes back to the button when the files are chosen and does not move when the batch ends.
    - **Open (phase 4):** a filter for the items still to complete (those that keep the default name `Item N`).
  - **Adding several:** "Add" saves the item. The form stays open and clean, with the focus on "Name" and the message "Added <name>", so several items can be added in a row. "Done" or the Escape key closes the form. Selecting another container closes the form and discards what was typed.
  - **Errors:** "Item name is required.", "Item name must have at most 60 characters.", "Quantity is required.", "Quantity must be a whole number from 0 to 9999."
  - **List:** each row shows the name, the quantity ("Qty 3", or "None left" when it is 0), the category and the full description with its line breaks. The rows are in order by name, ignoring upper/lower case and comparing the numbers inside a name by their value (`Item 2` before `Item 10`, `Nails 2` before `Nails 10`); this is the display order only, the stored order is the order the items were added in. A container without items shows "No items yet."
  - **Photo:** a row of an item with a photo shows its thumbnail on the left of the text, as a square button of 64 px with the photo cropped to it (accessible name "View photo of Hammer"). Pressing it opens the photo window. A row of an item without a photo shows the text button "Add photo" (accessible name "Add photo to Hammer") in its own line, above the icon buttons; an item with a photo does not show it. "Add photo" opens the edit form of that item (FR-10) with the focus on its photo field; it does not open the file picker by itself. Having a photo or not is told by the thumbnail or the text, never by color alone.
  - **Photo window:** the full photo is shown in a modal window (the native `<dialog>`) with the name of the item as its title, the photo (text for screen readers: "Photo of Hammer") and the button "Close". The focus goes to "Close" and stays inside the window; "Close" or the Escape key closes it and the focus returns to the thumbnail. The window is not one of the actions of "one at a time" (FR-10): it does not close a form that is open. Selecting another container closes it.
  - **Units out:** a row with units out also shows, below its text, a line in a bordered box with bold text: "20 of 100 out". The quantity stays the total: "Qty 100" and "20 of 100 out". When all the units are out the row shows "Qty 4" and "4 of 4 out", not "None left". "Out" is said with text, never with color alone.
  - **Row buttons:** below the text of each row there are the icon buttons "Take out" (a box with an arrow leaving it; only when units are inside, see FR-10b), "Edit" (a pencil) and "Delete" (a trash can), in that order, drawn as inline SVG (no icon library). Each one has an accessible name and a tooltip with the item name ("Take out Hammer", "Edit Hammer", "Delete Hammer"), a touch target of 44 × 44 px with space between them, and a visible focus ring for the keyboard. Their meaning does not rely on color alone. Two items with the same name have buttons with the same name.
- FR-10: Edit an item, change its quantity, and remove it.
  - **Edit:** "Edit" opens the item form in place of that row, filled with the data of the item, with the title "Edit item", the buttons "Save" and "Cancel", and the focus on "Name". The fields, limits, category suggestions and errors are the ones of FR-9. The quantity (the total) is edited in this form; take out, put back and used have their own forms (FR-10b). When the item has units out, a text under "Quantity" says so ("20 are out of the container.") and a quantity lower than the units out gives the error "Quantity can't be lower than the units that are out (20)." The photo field shows the photo of the item, which can be replaced (with "Replace" or, on touch screens, "Take photo") or removed there. When the form is opened with "Add photo" of the row, the focus goes to the photo field instead of "Name". The Escape key is the same as "Cancel", and both put the focus back on the button of the row that opened the form ("Edit" or "Add photo").
  - **Save:** "Save" saves the item, closes the form, shows the message "Saved <name>" and puts the focus on the "Edit" button of that row, in its new place if the name changed. "Save" without changes does the same. The item keeps its id and its place in the stored order. The category follows the rule for editing in "Item fields". Nothing is saved until "Save": closing or reloading the page while the form is open leaves the item as it was. A new or replaced photo is saved first; if that fails the form stays open with "Couldn't save the photo." and the item is not saved. A photo that was replaced or removed is deleted once the item is saved.
  - **Remove:** "Delete" asks in the row, in place of the buttons of that row, with the same inline confirmation as containers and rooms (no browser dialogs, no undo): `Delete "Hammer"? This cannot be undone.` with the buttons "Yes, delete" and "Cancel". When the item has units out the question says so: `Delete "Nails"? 20 of 100 are out of the container. This cannot be undone.` The question does not mention the photo; removing an item deletes its photo. The focus goes to "Cancel". After "Yes, delete" the message "Deleted <name>" is shown and the focus goes to the "Edit" button of the next row, or of the row before when the last row was removed, or to "Add item" when the list is left empty. "Cancel" or the Escape key closes the confirmation and puts the focus back on the "Delete" button of that row.
  - **One at a time:** only one of these is open in the items section: the "Add item" form, the edit form of one item, the delete confirmation of one item, or the take out, put back or used form of one item (FR-10b). Starting another one closes the one before and discards what was typed. Selecting another container closes it too. "Add several photos" (FR-9) is not one of them: starting a batch does not close or discard a form that is open in a row (the edit form, the delete confirmation, or the take out, put back or used form), and while the batch runs only its own button is unavailable.
  - **Messages:** "Saved <name>" and "Deleted <name>", and the messages of FR-10b, are shown in a status line of the items section, which screen readers announce. The line is cleared when another action starts or another container is selected.
- FR-10b: Take units of an item out of its container, put them back, or mark them as used (see "Items that are out of their container").
  - **Buttons:** "Take out" is an icon button of the row (FR-9), shown only when units are inside. "Put back" and "Used" are text buttons below the "20 of 100 out" line, shown only when units are out; their accessible names have the item name ("Put back Nails", "Used Nails").
  - **Forms:** each button opens a small form in the row, in place of the buttons of that row (the text of the row stays). It has one field, "Quantity" (a text field with a numeric keyboard), with the focus on it and its text selected, and "Cancel". Nothing is saved until an action button is pressed. The Escape key is the same as "Cancel". The rule "one at a time" of FR-10 applies.
  - **Take out or use:** the form of "Take out" has the title "Take out or use <name>" and the quantity pre-filled with all the units inside (range: 1 to the units inside). It has two actions for that quantity. "Take out": the units go out and the quantity does not change. "Mark as used": the quantity goes down by that number, without going through "out", and the units out do not change. The Enter key always runs "Take out", because it can be reverted with "Put back"; "Mark as used" needs a click.
  - **Put back:** title "Put back <name>", button "Put back", quantity pre-filled with all the units out (range: 1 to the units out). The units return to the container.
  - **Used:** title "Mark <name> as used", button "Used", quantity pre-filled with all the units out (range: 1 to the units out). The quantity and the units out go down by that number.
  - **Errors:** "Quantity is required." and "Quantity must be a whole number from 1 to 80." (the maximum of that form; "Quantity must be 1." when the maximum is 1). Only whole numbers are accepted and nothing is rounded.
  - **Messages:** "Took out 20 of Nails", "Put back 5 of Nails" and "Marked 15 of Nails as used" (for both ways of using units), in the status line of FR-10.
  - **Focus:** after an action the focus returns to the button that opened the form if the row still has it. If it is gone, the focus goes to the nearest one: to "Put back" when no units are left inside but some are out, to "Take out" when no units are out but some are inside, and to "Edit" when the quantity reached 0. "Cancel" or the Escape key puts the focus back on the button that opened the form.

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
- **Temporary storage:** rooms, with their containers and (from phase 3) their items, are kept in the browser's localStorage (key `sorterhome.rooms.v1`) through `RoomStore`. Stored data is validated on load and invalid entries are discarded. This storage is per browser: it is not shared across devices or people.
- **Tolerant loading of items:** a container saved before items existed loads with an empty list. An item is discarded only when it has no usable name (missing, not text, or empty after trimming). Everything else is repaired and the item is kept: a missing or repeated id becomes a new id; a name, description or category that is too long is cut to its maximum; a quantity that is a number is rounded and kept between 0 and 9999, and one that is not a number becomes 1; the units out (`quantityOut`) that are missing (items saved before step 3.3) or are not a number become 0, and a number is rounded and kept between 0 and the quantity of the item (units out above the quantity are lowered to the quantity); a description or category that is not text becomes empty; a photo id (`photoId`) that is missing (items saved before step 3.4) or is not a text becomes empty, so the item has no photo. Whether the photo still exists is not checked when loading (see "Photos before the backend exists").
- **Photo storage:** the photos are kept in the browser's IndexedDB, in the database `sorterhome`, with one object store for each version (`photo-thumbnails` and `photo-full`) and the photo id as the key. Like localStorage, it is per browser.
- **Replacing it later:** when the backend exists, `RoomStore` is replaced by calls to the API. The routes stay the same. The pages will need loading and error states because network calls are asynchronous.
- **Frontend conventions (Angular 22):** Signal Forms, the `@Service` decorator, lazy-loaded routes, Vitest for tests. Pages live in `src/app/pages/`, shared logic in `src/app/core/`.

## 13. Roadmap (simple → complex)
0. Setup: tools, GitHub repository, Claude project, CLAUDE.md — **done**. The Angular frontend is scaffolded (SCSS, routing, no SSR).
1. Rooms as resizable floor plans with a 1 ft grid — **done**: plan drawing, pages, local storage and resizing by dragging.
   - Planned improvements to the plan view: zoom and pan (the view is frozen while dragging, so growing a room a lot takes several drags); resizing with the keyboard (accessibility); resize handles on the left and top edges (needs a rule for moving the containers inside, so it waits until containers exist).
2. Containers on the plan:
   - 2.1 Container model, SVG toolbox, drag with green/red shadow, tap to add, name panel, delete, room cannot shrink under containers — **done**
   - 2.2 Move containers with 1 in snap, rotate 90° — **done**
   - 2.3 Stacking, stack order — **done**
3. Items:
   - 3.1 Item model and storage, "Add item" form (name, quantity, description, category), item list in the container panel — **done**
   - 3.2 Edit an item, change its quantity, remove it — **done**
   - 3.3 Take out, put back and used — **done**
   - 3.4 Photo (IndexedDB, reduced in size before saving, "Add photo" prompt) — **done**
   - 3.5 Several photos at once, one item per photo — **done**
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
- When the browser storage is full or not available, the write error is ignored: the change stays in memory, the user sees no message, and it is lost when the page is reloaded.
- Move an item to another container (today the item must be removed and added again).
- A history of the movements of each item: every take out, put back and used is recorded, with the option to undo any of them. It would also tell the user where the units went, and it would help the search phase. Until then, a mistaken "used" is corrected with Edit.
- The delete confirmations of containers and rooms lose the keyboard focus when they open, because the "Delete" button is replaced by the confirmation. The confirmation of an item already moves the focus to "Cancel".
- Photos and two tabs: if a tab starts in the instant when another tab has saved a photo and not yet its item, the startup cleanup deletes that photo. The item is then shown without a photo and the photo can be added again.
- The browser may delete the data of IndexedDB by itself (for example when the device is low on space, or after a long time without visiting the site), and the photos with it. The items stay and are shown without a photo. Asking the browser for persistent storage (`navigator.storage.persist()`) is left for the deploy step.
- Large photos: verify with a real large photo (for example 48 MP) on a real phone. Decoding a 48 MP photo needs about 190 MB of memory, and a phone could close the tab before the photo is reduced. The 30 MB limit is on the size of the file, not on the number of pixels.
- "Add several photos" has no Cancel button: the batch stops when the user selects another container or the container is deleted, and the items already created stay. Verify with 20 large photos on a real phone (the time, the memory, and that the tab is not closed).
- The order of the files of "Add several photos" is the one the browser gives, which is not guaranteed to be the order in which the user chose or took the photos, so `Item 1`, `Item 2`... may not follow it.
- An item created from a photo is not told apart from any other until the search phase (a filter for the items still to complete, see FR-9).
