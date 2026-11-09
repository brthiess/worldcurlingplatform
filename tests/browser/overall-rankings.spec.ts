import {test,expect} from "@playwright/test";
import {signInWithRateWindow} from "./auth-fixture";
test("overall review loads and shows honest empty/input state",async({page})=>{
 await page.goto("/admin");await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);await signInWithRateWindow(page,page.getByRole("button",{name:"Sign in",exact:true}));
 await page.goto("/admin/overall-rankings");await expect(page.getByRole("heading",{name:"Four-player overall drafts"})).toBeVisible();
 await expect(page.getByLabel("Effective date",{exact:true})).toBeVisible();
});
