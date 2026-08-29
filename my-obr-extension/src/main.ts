import OBR from "@owlbear-rodeo/sdk";

const METADATA_KEY = "com.myextension.inventory/data";

interface Equipment {
  head?: string;
  chest?: string;
  weapon?: string;
  shield?: string;
  boots?: string;
  accessory?: string;
}

interface Item {
  id: string;
  name: string;
  count: number;
}

interface TokenInventoryData {
  type: "character" | "container";
  isLocked?: boolean;
  ownerName?: string;
  equipment: Equipment;
  backpack: Item[];
}

interface ItemTargetOption {
  id: string;
  name: string;
}

let selectedTokenId: string | null = null;
let availableTargetTokens: ItemTargetOption[] = [];

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  const playerName = await OBR.player.getName();
  const isGM = role === "GM";

  const app = document.querySelector<HTMLDivElement>("#app")!;

  app.innerHTML = `
    <div style="padding: 12px; color: #e0e0e0; font-family: sans-serif; box-sizing: border-box; font-size: 13px;">
      <h3 style="margin-top: 0; margin-bottom: 6px; color: #fff;">📦 RPG Inventory & Áthelyezés</h3>
      <div id="target-name" style="font-size: 0.85em; opacity: 0.8; margin-bottom: 10px; font-style: italic; color: #aaa;">
        Válassz ki egy tokent!
      </div>

      <!-- ZÁROLT / JOGOSULTSÁG HIÁNYA ÜZENET -->
      <div id="locked-message" style="display: none; background: #3a1c1c; border: 1px solid #f44336; color: #ffcdd2; padding: 12px; border-radius: 6px; text-align: center; margin-top: 10px;">
        🔒 Nincs hozzáférésed ehhez az inventory-hoz.
      </div>

      <div id="main-container" style="display: none;">
        <!-- DM vezérlők (Csak GM) -->
        <div id="dm-controls-wrapper" style="display: ${isGM ? "flex" : "none"}; flex-direction: column; gap: 8px; background: #2a2a2a; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.85em; color: #bbb;">Beállítások (DM):</span>
            <label style="cursor: pointer; font-weight: bold; color: #ffca28; font-size: 0.85em; display: flex; align-items: center; gap: 4px;">
              <input type="checkbox" id="lock-checkbox"> 🔒 Globális Zárolás
            </label>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; border-top: 1px solid #333; padding-top: 6px;">
            <span style="font-size: 0.75em; color: #aaa;">👤 Tulajdonos Játékos:</span>
            <input id="owner-name-input" type="text" placeholder="Játékos pontos neve..." style="flex: 1; padding: 3px 6px; background: #1e1e24; color: white; border: 1px solid #444; border-radius: 3px; font-size: 0.8em;" />
          </div>

          <div style="display: flex; gap: 12px; align-items: center; border-top: 1px solid #333; padding-top: 6px;">
            <label style="cursor: pointer;"><input type="radio" name="token-type" value="character" id="type-char"> 👤 Karakter</label>
            <label style="cursor: pointer;"><input type="radio" name="token-type" value="container" id="type-chest"> 📦 Láda</label>
          </div>
        </div>

        <!-- KARAKTER FELSZERELÉS SLOTOK -->
        <div id="equipment-section" style="display: none; background: #1e1e24; padding: 10px; border-radius: 8px; border: 1px solid #333; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #ffca28; font-size: 0.9em; border-bottom: 1px solid #333; padding-bottom: 4px;">
            ⚔️ Felvértezett Felszerelés
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">🪖 Sisak / Fej</label>
              <input data-slot="head" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">🛡️ Páncél / Mellkas</label>
              <input data-slot="chest" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">⚔️ Fegyver</label>
              <input data-slot="weapon" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">🛡️ Pajzs / Másodkéz</label>
              <input data-slot="shield" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">🥾 Csizma / Láb</label>
              <input data-slot="boots" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
            <div>
              <label style="font-size: 0.75em; color: #888; display: block;">💍 Amulett / Gyűrű</label>
              <input data-slot="accessory" class="equip-input" type="text" placeholder="Üres..." style="width: 100%; padding: 4px; border-radius: 3px; border: 1px solid #444; background: #2b2b2b; color: white; box-sizing: border-box;" />
            </div>
          </div>
        </div>

        <!-- HÁTIZSÁK / LÁDA INVENTORY -->
        <div style="background: #1e1e24; padding: 10px; border-radius: 8px; border: 1px solid #333;">
          <div id="backpack-title" style="font-weight: bold; margin-bottom: 8px; color: #4fc3f7; font-size: 0.9em;">
            🎒 Hátizsák / Tárgyak
          </div>

          <div id="add-item-bar" style="display: flex; gap: 6px; margin-bottom: 8px;">
            <input id="item-name" type="text" placeholder="Új tárgy neve..." style="flex: 2; padding: 5px; border-radius: 4px; border: 1px solid #444; background: #2b2b2b; color: white;" />
            <input id="item-count" type="number" value="1" min="1" style="width: 45px; padding: 5px; border-radius: 4px; border: 1px solid #444; background: #2b2b2b; color: white;" />
            <button id="add-btn" style="padding: 5px 10px; background: #388e3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
          </div>

          <div style="margin-bottom: 8px; background: #26262e; padding: 6px; border-radius: 4px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.75em; color: #aaa;">➡️ Cél token:</span>
            <select id="transfer-target-select" style="flex: 1; padding: 3px; background: #1e1e24; color: white; border: 1px solid #444; border-radius: 3px; font-size: 0.8em;"></select>
          </div>

          <ul id="item-list" style="list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto;"></ul>
        </div>
      </div>
    </div>
  `;

  const targetNameEl = document.querySelector("#target-name")!;
  const lockedMessageEl = document.querySelector<HTMLDivElement>("#locked-message")!;
  const mainContainer = document.querySelector<HTMLDivElement>("#main-container")!;
  const equipSection = document.querySelector<HTMLDivElement>("#equipment-section")!;
  const addItemBar = document.querySelector<HTMLDivElement>("#add-item-bar")!;
  const backpackTitle = document.querySelector("#backpack-title")!;
  const itemListEl = document.querySelector("#item-list")!;
  const typeCharRadio = document.querySelector<HTMLInputElement>("#type-char")!;
  const typeChestRadio = document.querySelector<HTMLInputElement>("#type-chest")!;
  const lockCheckbox = document.querySelector<HTMLInputElement>("#lock-checkbox")!;
  const ownerInput = document.querySelector<HTMLInputElement>("#owner-name-input")!;
  const addBtn = document.querySelector("#add-btn")!;
  const transferSelect = document.querySelector<HTMLSelectElement>("#transfer-target-select")!;

  OBR.player.onChange(() => updateSelection());
  OBR.scene.items.onChange(() => refreshTargetTokens());

  updateSelection();

  // Hozzáférési ellenőrző segédfüggvény
  function checkAccess(data: TokenInventoryData): boolean {
    if (isGM) return true;

    const isOwner = data.ownerName && data.ownerName.trim().toLowerCase() === playerName.trim().toLowerCase();
    const hasOwnerRestriction = !!(data.ownerName && data.ownerName.trim().length > 0);

    if (hasOwnerRestriction) {
      return isOwner;
    }
    return !data.isLocked;
  }

  async function updateSelection() {
    const selection = await OBR.player.getSelection();

    if (selection && selection.length === 1) {
      selectedTokenId = selection[0];
      const items = await OBR.scene.items.getItems([selectedTokenId]);

      if (items.length > 0) {
        const token = items[0];
        targetNameEl.textContent = `Kijelölve: ${token.name || "Névtelen token"}`;
        await refreshTargetTokens();
        loadTokenData(token);
        return;
      }
    }

    selectedTokenId = null;
    targetNameEl.textContent = "Válassz ki egyetlen tokent a térképen!";
    mainContainer.style.display = "none";
    lockedMessageEl.style.display = "none";
  }

  async function refreshTargetTokens() {
    if (!selectedTokenId) return;

    const allItems = await OBR.scene.items.getItems();

    // Szűrés:
    // 1. Nem lehet a saját maga által kijelölt token
    // 2. Csak CHARACTER rétegen lévő token
    // 3. CSAK OLYAN TOKEN, AMELYHEZ VAN HOZZÁFÉRÉSE A JÁTÉKOSNAK
    availableTargetTokens = allItems
      .filter((i) => {
        if (i.id === selectedTokenId || i.layer !== "CHARACTER") return false;
        
        const data: TokenInventoryData = i.metadata[METADATA_KEY] as TokenInventoryData || {
          type: "character",
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };

        return checkAccess(data);
      })
      .map((i) => ({ id: i.id, name: i.name || "Névtelen Token" }));

    transferSelect.innerHTML = "";
    if (availableTargetTokens.length === 0) {
      transferSelect.innerHTML = `<option value="">Nincs elérhető cél token</option>`;
      return;
    }

    availableTargetTokens.forEach((target) => {
      const opt = document.createElement("option");
      opt.value = target.id;
      opt.textContent = target.name;
      transferSelect.appendChild(opt);
    });
  }

  function loadTokenData(token: any) {
    const data: TokenInventoryData = token.metadata[METADATA_KEY] || {
      type: "character",
      isLocked: false,
      ownerName: "",
      equipment: {},
      backpack: []
    };

    const canAccess = checkAccess(data);

    if (!canAccess) {
      mainContainer.style.display = "none";
      lockedMessageEl.style.display = "block";
      if (data.ownerName && data.ownerName.trim().length > 0) {
        lockedMessageEl.textContent = `🔒 Ez a token '${data.ownerName}' tulajdona.`;
      } else {
        lockedMessageEl.textContent = "🔒 Ez az inventory zárolva van a DM által.";
      }
      return;
    }

    lockedMessageEl.style.display = "none";
    mainContainer.style.display = "block";

    lockCheckbox.checked = !!data.isLocked;
    ownerInput.value = data.ownerName || "";

    if (data.type === "container") {
      typeChestRadio.checked = true;
      equipSection.style.display = "none";
      backpackTitle.textContent = "📦 Láda Tartalma";
      addItemBar.style.display = isGM ? "flex" : "none";
    } else {
      typeCharRadio.checked = true;
      equipSection.style.display = "block";
      backpackTitle.textContent = "🎒 Hátizsák / Egyéb Tárgyak";
      addItemBar.style.display = "flex";
    }

    const equipInputs = document.querySelectorAll<HTMLInputElement>(".equip-input");
    equipInputs.forEach((input) => {
      const slot = input.dataset.slot as keyof Equipment;
      input.value = data.equipment[slot] || "";
    });

    renderBackpack(data.backpack);
  }

  ownerInput.addEventListener("change", async () => {
    if (!selectedTokenId || !isGM) return;

    await OBR.scene.items.updateItems([selectedTokenId], (items) => {
      for (let item of items) {
        const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
          type: "character",
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };
        currentData.ownerName = ownerInput.value.trim();
        item.metadata[METADATA_KEY] = currentData;
      }
    });
  });

  lockCheckbox.addEventListener("change", async () => {
    if (!selectedTokenId || !isGM) return;

    await OBR.scene.items.updateItems([selectedTokenId], (items) => {
      for (let item of items) {
        const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
          type: "character",
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };
        currentData.isLocked = lockCheckbox.checked;
        item.metadata[METADATA_KEY] = currentData;
      }
    });
  });

  const handleTypeChange = async (newType: "character" | "container") => {
    if (!selectedTokenId || !isGM) return;
    await OBR.scene.items.updateItems([selectedTokenId], (items) => {
      for (let item of items) {
        const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
          type: newType,
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };
        currentData.type = newType;
        item.metadata[METADATA_KEY] = currentData;
      }
    });
    updateSelection();
  };

  typeCharRadio.addEventListener("change", () => handleTypeChange("character"));
  typeChestRadio.addEventListener("change", () => handleTypeChange("container"));

  document.querySelectorAll<HTMLInputElement>(".equip-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      if (!selectedTokenId) return;
      const slot = (e.target as HTMLInputElement).dataset.slot as keyof Equipment;
      const value = (e.target as HTMLInputElement).value.trim();

      await OBR.scene.items.updateItems([selectedTokenId], (items) => {
        for (let item of items) {
          const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
            type: "character",
            isLocked: false,
            ownerName: "",
            equipment: {},
            backpack: []
          };
          currentData.equipment[slot] = value;
          item.metadata[METADATA_KEY] = currentData;
        }
      });
    });
  });

  function renderBackpack(backpack: Item[]) {
    itemListEl.innerHTML = "";

    if (!backpack || backpack.length === 0) {
      itemListEl.innerHTML = `<li style="font-size: 0.8em; opacity: 0.5; text-align: center; padding: 6px;">Nincs tárgy a listában.</li>`;
      return;
    }

    backpack.forEach((item) => {
      const li = document.createElement("li");
      li.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #2a2a2a; margin-bottom: 4px; padding: 4px 6px; border-radius: 4px; font-size: 0.85em;";
      
      li.innerHTML = `
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px;">
          <strong>${item.count}x</strong> ${item.name}
        </span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <input class="take-count-input" type="number" value="1" min="1" max="${item.count}" style="width: 40px; padding: 2px 4px; border-radius: 3px; border: 1px solid #444; background: #1e1e24; color: white; font-size: 0.85em;" />
          <button class="transfer-btn" data-id="${item.id}" title="Átraksz a kiválasztott célpontba" style="background: #0288d1; color: white; border: none; border-radius: 3px; padding: 3px 6px; cursor: pointer; font-size: 0.8em; font-weight: bold;">➡️ Átadás</button>
          <button class="del-btn" data-id="${item.id}" title="Összes törlése" style="background: #d32f2f; color: white; border: none; border-radius: 3px; padding: 3px 6px; cursor: pointer; font-size: 0.8em; font-weight: bold;">X</button>
        </div>
      `;

      const takeInput = li.querySelector<HTMLInputElement>(".take-count-input")!;

      li.querySelector(".transfer-btn")?.addEventListener("click", () => {
        const amountToTransfer = parseInt(takeInput.value, 10) || 1;
        const targetTokenId = transferSelect.value;
        if (!targetTokenId) {
          alert("Nincs kiválasztott vagy elérhető cél token!");
          return;
        }
        transferItem(item, amountToTransfer, targetTokenId);
      });

      li.querySelector(".del-btn")?.addEventListener("click", () => removeItem(item.id));

      itemListEl.appendChild(li);
    });
  }

  addBtn.addEventListener("click", async () => {
    if (!selectedTokenId) return;

    const nameInput = document.querySelector<HTMLInputElement>("#item-name")!;
    const countInput = document.querySelector<HTMLInputElement>("#item-count")!;

    const name = nameInput.value.trim();
    const count = parseInt(countInput.value, 10) || 1;

    if (!name) return;

    await OBR.scene.items.updateItems([selectedTokenId], (items) => {
      for (let item of items) {
        const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
          type: "character",
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };
        const newItem: Item = { id: crypto.randomUUID(), name, count };
        currentData.backpack = [...(currentData.backpack || []), newItem];
        item.metadata[METADATA_KEY] = currentData;
      }
    });

    nameInput.value = "";
    countInput.value = "1";
    updateSelection();
  });

  async function transferItem(sourceItem: Item, amountToTransfer: number, targetTokenId: string) {
    if (!selectedTokenId || amountToTransfer <= 0) return;

    const actualAmount = Math.min(sourceItem.count, amountToTransfer);

    await OBR.scene.items.updateItems([selectedTokenId, targetTokenId], (tokens) => {
      const sourceToken = tokens.find((t) => t.id === selectedTokenId);
      const targetToken = tokens.find((t) => t.id === targetTokenId);

      if (!sourceToken || !targetToken) return;

      const sourceData: TokenInventoryData = sourceToken.metadata[METADATA_KEY] || {
        type: "character",
        isLocked: false,
        ownerName: "",
        equipment: {},
        backpack: []
      };

      const targetData: TokenInventoryData = targetToken.metadata[METADATA_KEY] || {
        type: "character",
        isLocked: false,
        ownerName: "",
        equipment: {},
        backpack: []
      };

      // Végső ellenőrzés: ha a játékos trükközne, akkor sem tud más zárolt tárhelyére pakolni
      if (!checkAccess(sourceData) || !checkAccess(targetData)) {
        console.warn("Nincs jogosultságod az áthelyezéshez!");
        return;
      }

      sourceData.backpack = (sourceData.backpack || [])
        .map((i) => {
          if (i.id === sourceItem.id) {
            return { ...i, count: i.count - actualAmount };
          }
          return i;
        })
        .filter((i) => i.count > 0);

      sourceToken.metadata[METADATA_KEY] = sourceData;

      targetData.backpack = targetData.backpack || [];
      const existingItem = targetData.backpack.find(
        (i) => i.name.toLowerCase() === sourceItem.name.toLowerCase()
      );

      if (existingItem) {
        existingItem.count += actualAmount;
      } else {
        targetData.backpack.push({
          id: crypto.randomUUID(),
          name: sourceItem.name,
          count: actualAmount
        });
      }

      targetToken.metadata[METADATA_KEY] = targetData;
    });

    updateSelection();
  }

  async function removeItem(itemId: string) {
    if (!selectedTokenId) return;

    await OBR.scene.items.updateItems([selectedTokenId], (items) => {
      for (let item of items) {
        const currentData: TokenInventoryData = item.metadata[METADATA_KEY] || {
          type: "character",
          isLocked: false,
          ownerName: "",
          equipment: {},
          backpack: []
        };
        currentData.backpack = (currentData.backpack || []).filter((i) => i.id !== itemId);
        item.metadata[METADATA_KEY] = currentData;
      }
    });

    updateSelection();
  }
});