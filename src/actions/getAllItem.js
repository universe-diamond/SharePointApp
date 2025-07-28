import { axiosRequest } from "../utils/axiosRequest";

export async function getAllItems(listName, keys) {
  let allItems = [];

  const sharepointSiteUrl = "https://e1aoa.sharepoint.com/sites/Project-Management";

  let nextUrl = `${sharepointSiteUrl}/_api/web/lists/getbytitle('${listName}')/items?$top=100`;

  while (nextUrl) {

    const responseData = await axiosRequest("get", listName, nextUrl, null, true);

    allItems = allItems.concat(responseData.value);

    nextUrl = responseData['odata.nextLink'] || null;
  }

  allItems = allItems.map((it) => {
    const temp = {};
    keys.map((key) => (temp[key] = it[key]));
    return temp;
  });

  return allItems;
}